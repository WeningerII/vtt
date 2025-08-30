/**
 * AI Assistant service for natural language rule queries and game assistance
 */

import { PrismaClient } from "@prisma/client";
// import { OpenAIProvider, AnthropicProvider } from "@vtt/ai"; // Temporarily disabled due to build issues

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
    timestamp: Date;
  };
}

export function createAIAssistantService(prisma: PrismaClient) {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  let openaiProvider: OpenAIProvider | null = null;
  let anthropicProvider: AnthropicProvider | null = null;

  if (openaiKey && openaiKey.trim().length > 0) {
    openaiProvider = new OpenAIProvider({ apiKey: openaiKey });
  }

  if (anthropicKey && anthropicKey.trim().length > 0) {
    anthropicProvider = new AnthropicProvider({ apiKey: anthropicKey });
  }

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

  async function queryRules(query: AssistantQuery): Promise<AssistantResponse> {
    const provider = anthropicProvider || openaiProvider;
    if (!provider) {
      throw new Error(
        "No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.",
      );
    }

    const _started = Date.now();
    const gameSystem = query.context?.gameSystem || "D&D 5e";

    const contextualPrompt = `${query.question}

Context:
- Game System: ${gameSystem}
- Player Level: ${query.context?.playerLevel || "Unknown"}
- Character Class: ${query.context?.characterClass || "Unknown"}
${query.context?.campaignId ? `- Campaign ID: ${query.context.campaignId}` : ""}`;

    try {
      let result;

      if (provider instanceof AnthropicProvider) {
        result = await provider.generateText(contextualPrompt, {
          systemPrompt: D5E_SYSTEM_PROMPT,
          maxTokens: 1000,
          temperature: 0.3, // Lower temperature for more consistent rule answers
        });
      } else if (provider instanceof OpenAIProvider) {
        result = await provider.generateText(contextualPrompt, {
          systemPrompt: D5E_SYSTEM_PROMPT,
          maxTokens: 1000,
          temperature: 0.3,
        });
      } else {
        throw new Error("Unsupported provider type");
      }

      // Log the query for analytics
      await prisma.generationJob.create({
        data: {
          type: "TEXT_TO_IMAGE", // We'd need RULE_QUERY type in schema
          status: "SUCCEEDED",
          input: { query: query.question, context: query.context } as any,
          output: { answer: result.text } as any,
        },
      });

      return {
        answer: result.text,
        confidence: 0.85, // Could be calculated based on response patterns
        metadata: {
          provider: provider instanceof AnthropicProvider ? "anthropic" : "openai",
          model: result.model,
          costUSD: result.costUSD,
          latencyMs: result.latencyMs,
          timestamp: new Date(),
        },
      };
    } catch (error: any) {
      await prisma.generationJob.create({
        data: {
          type: "TEXT_TO_IMAGE",
          status: "FAILED",
          input: { query: query.question } as any,
          error: error.message,
        },
      });

      throw error;
    }
  }

  async function explainSpell(spellName: string, context?: AssistantQuery["context"]) {
    const payload: AssistantQuery = context
      ? {
          question: `Explain the D&D 5e spell "${spellName}" including its mechanics, components, duration, and common use cases.`,
          context,
        }
      : {
          question: `Explain the D&D 5e spell "${spellName}" including its mechanics, components, duration, and common use cases.`,
        };
    return queryRules(payload);
  }

  async function explainRule(ruleTopic: string, context?: AssistantQuery["context"]) {
    const payload: AssistantQuery = context
      ? {
          question: `Explain the D&D 5e rule about "${ruleTopic}" with specific mechanics and examples.`,
          context,
        }
      : {
          question: `Explain the D&D 5e rule about "${ruleTopic}" with specific mechanics and examples.`,
        };
    return queryRules(payload);
  }

  async function suggestActions(situation: string, context?: AssistantQuery["context"]) {
    const payload: AssistantQuery = context
      ? {
          question: `In D&D 5e, what are the best action options for: ${situation}? Consider tactical advantages and rule interactions.`,
          context,
        }
      : {
          question: `In D&D 5e, what are the best action options for: ${situation}? Consider tactical advantages and rule interactions.`,
        };
    return queryRules(payload);
  }

  async function clarifyInteraction(interaction: string, context?: AssistantQuery["context"]) {
    const payload: AssistantQuery = context
      ? {
          question: `How do these D&D 5e mechanics interact: ${interaction}? Explain any special rules or edge cases.`,
          context,
        }
      : {
          question: `How do these D&D 5e mechanics interact: ${interaction}? Explain any special rules or edge cases.`,
        };
    return queryRules(payload);
  }

  async function generateRuling(scenario: string, context?: AssistantQuery["context"]) {
    const payload: AssistantQuery = context
      ? {
          question: `As a D&D 5e DM, how would you rule on this scenario: ${scenario}? Provide reasoning based on official rules and game balance.`,
          context,
        }
      : {
          question: `As a D&D 5e DM, how would you rule on this scenario: ${scenario}? Provide reasoning based on official rules and game balance.`,
        };
    return queryRules(payload);
  }

  return {
    queryRules,
    explainSpell,
    explainRule,
    suggestActions,
    clarifyInteraction,
    generateRuling,
  };
}
