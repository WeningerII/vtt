/**
 * AI Assistant service for natural language rule queries and game assistance
 */

import { JobStatus, JobType, Prisma, PrismaClient } from "@prisma/client";
import { createAIServices } from "./service";
import { getErrorMessage } from "../utils/errors";

export interface AssistantQuery {
  question: string;
  context?: {
    gameSystem?: string;
    campaignId?: string;
    sceneId?: string;
    playerLevel?: number;
    characterClass?: string;
  };
}

export interface AssistantResponse {
  answer: string;
  sources?: string[];
  confidence: number;
  metadata: {
    provider: string;
    model: string;
    costUSD: number;
    latencyMs: number;
    respondedAt: Date;
  };
}

export function createAssistantService(prisma: PrismaClient) {
  // Initialize AI services with router and provider management
  const aiServices = createAIServices(prisma);
  const aiRouter = aiServices.router;

  const D5E_SYSTEM_PROMPT = `You are an expert D&D 5th Edition rules assistant and game master. You have comprehensive knowledge of:
- Player's Handbook, Dungeon Master's Guide, Monster Manual
- All official D&D 5e rules, spells, classes, races, and mechanics
- Combat mechanics, spell interactions, and edge cases
- Character creation and advancement
- Game balance and encounter design

Provide accurate, helpful answers with specific rule references when possible. If a rule is ambiguous or has multiple interpretations, explain the options. Always prioritize official rules over homebrew unless specifically asked about homebrew content.

Format your responses clearly with:
1. Direct answer to the question
2. Relevant rule references (book and page if known)  
3. Any important caveats or edge cases
4. Practical gameplay advice when appropriate`;

  async function askQuestion(query: AssistantQuery): Promise<AssistantResponse> {
    const startTime = Date.now();
    try {
      // Check if AI router has available providers
      const providers = aiServices.listProviders();
      const hasAIProviders = providers.length > 0 && providers.some((p) => p.name !== "dummy");

      if (hasAIProviders) {
        // Use AI router for text completion
        const gameSystem = query.context?.gameSystem || "D&D 5e";
        const contextualPrompt = `${query.question}

Context:
- Game System: ${gameSystem}
- Player Level: ${query.context?.playerLevel || "Unknown"}
- Character Class: ${query.context?.characterClass || "Unknown"}
${query.context?.campaignId ? `- Campaign ID: ${query.context.campaignId}` : ""}`;

        const response = await aiRouter.generateText({
          prompt: `${D5E_SYSTEM_PROMPT}\n\nUser Query: ${contextualPrompt}`,
          maxTokens: 1000,
          temperature: 0.3,
        });

        const inputData = JSON.parse(
          JSON.stringify({ query: query.question, context: query.context }),
        ) as Prisma.InputJsonValue;
        const outputData = JSON.parse(
          JSON.stringify({ answer: response.text }),
        ) as Prisma.InputJsonValue;

        await prisma.generationJob.create({
          data: {
            type: JobType.TEXT_TO_IMAGE,
            status: JobStatus.SUCCEEDED,
            input: inputData,
            output: outputData,
          },
        });

        return {
          answer: response.text,
          sources: ["AI Assistant", "D&D 5e Knowledge Base"],
          confidence: 0.85,
          metadata: {
            provider: response.provider || "ai-router",
            model: response.model || "unknown",
            costUSD: response.costUSD || 0,
            latencyMs: Date.now() - startTime,
            respondedAt: new Date(),
          },
        };
      }

      // Fallback to rule-based if no AI providers
      const answer = generateRuleBasedAnswer(query);

      return {
        answer,
        sources: ["D&D 5e SRD", "VTT Rule Database"],
        confidence: 0.7,
        metadata: {
          provider: "fallback",
          model: "rule-based",
          costUSD: 0,
          latencyMs: Date.now() - startTime,
          respondedAt: new Date(),
        },
      };
    } catch (error: unknown) {
      throw new Error(`Assistant query failed: ${getErrorMessage(error)}`);
    }
  }

  function generateRuleBasedAnswer(query: AssistantQuery): string {
    const question = query.question.toLowerCase();

    // Basic rule matching for common D&D questions
    if (question.includes("spell") || question.includes("magic")) {
      return "Spells in D&D 5e require spell slots and follow specific casting rules. Check the spell description for components, range, and duration.";
    }

    if (question.includes("attack") || question.includes("combat")) {
      return "Combat in D&D 5e uses a turn-based system. Roll 1d20 + ability modifier + proficiency bonus for attack rolls.";
    }

    if (question.includes("advantage") || question.includes("disadvantage")) {
      return "Advantage means roll 2d20 and take the higher result. Disadvantage means roll 2d20 and take the lower result.";
    }

    if (question.includes("saving throw") || question.includes("save")) {
      return "Saving throws use 1d20 + ability modifier + proficiency bonus (if proficient). The DC is set by the spell or effect.";
    }

    if (question.includes("skill check") || question.includes("ability check")) {
      return "Ability checks use 1d20 + ability modifier + proficiency bonus (if proficient in the skill).";
    }

    // Default response
    return `I can help with D&D 5e rules and mechanics. Your question about "${query.question}" requires more specific rule lookup. Consider checking the Player's Handbook or asking your DM.`;
  }

  async function queryRules(query: AssistantQuery): Promise<AssistantResponse> {
    return askQuestion(query);
  }

  async function explainSpell(
    spellName: string,
    context?: AssistantQuery["context"],
  ): Promise<AssistantResponse> {
    return askQuestion({ question: `Explain the spell: ${spellName}`, context });
  }

  async function explainRule(
    ruleTopic: string,
    context?: AssistantQuery["context"],
  ): Promise<AssistantResponse> {
    return askQuestion({ question: `Explain the rule: ${ruleTopic}`, context });
  }

  async function suggestActions(
    situation: string,
    context?: AssistantQuery["context"],
  ): Promise<AssistantResponse> {
    return askQuestion({ question: `Suggest actions for: ${situation}`, context });
  }

  async function generateRuling(
    scenario: string,
    context?: AssistantQuery["context"],
  ): Promise<AssistantResponse> {
    return askQuestion({ question: `Generate a ruling for: ${scenario}`, context });
  }

  async function getQueryHistory(_filters?: { campaignId?: string; limit?: number }) {
    // Basic implementation - in production this would query the database
    return [];
  }

  return {
    askQuestion,
    queryRules,
    explainSpell,
    explainRule,
    suggestActions,
    generateRuling,
    getQueryHistory,
  };
}
