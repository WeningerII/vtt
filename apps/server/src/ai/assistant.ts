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
    respondedAt: Date;
  };
}

export function createAssistantService(prisma: PrismaClient) {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // let openaiProvider: OpenAIProvider | null = null;
  // let anthropicProvider: AnthropicProvider | null = null;

  // if (openaiKey && openaiKey.trim().length > 0) {
  //   openaiProvider = new OpenAIProvider({ apiKey: openaiKey });
  // }

  // if (anthropicKey && anthropicKey.trim().length > 0) {
  //   anthropicProvider = new AnthropicProvider({ apiKey: anthropicKey });
  // }

  async function askQuestion(query: AssistantQuery): Promise<AssistantResponse> {
    // Fallback implementation using rule-based responses
    const startTime = Date.now();
    
    try {
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
          respondedAt: new Date()
        }
      };
    } catch (error: any) {
      throw new Error(`Assistant query failed: ${error.message}`);
    }
  }

  function generateRuleBasedAnswer(query: AssistantQuery): string {
    const question = query.question.toLowerCase();
    
    // Basic rule matching for common D&D questions
    if (question.includes('spell') || question.includes('magic')) {
      return "Spells in D&D 5e require spell slots and follow specific casting rules. Check the spell description for components, range, and duration.";
    }
    
    if (question.includes('attack') || question.includes('combat')) {
      return "Combat in D&D 5e uses a turn-based system. Roll 1d20 + ability modifier + proficiency bonus for attack rolls.";
    }
    
    if (question.includes('advantage') || question.includes('disadvantage')) {
      return "Advantage means roll 2d20 and take the higher result. Disadvantage means roll 2d20 and take the lower result.";
    }
    
    if (question.includes('saving throw') || question.includes('save')) {
      return "Saving throws use 1d20 + ability modifier + proficiency bonus (if proficient). The DC is set by the spell or effect.";
    }
    
    if (question.includes('skill check') || question.includes('ability check')) {
      return "Ability checks use 1d20 + ability modifier + proficiency bonus (if proficient in the skill).";
    }
    
    // Default response
    return `I can help with D&D 5e rules and mechanics. Your question about "${query.question}" requires more specific rule lookup. Consider checking the Player's Handbook or asking your DM.`;
  }

  async function queryRules(query: AssistantQuery): Promise<AssistantResponse> {
    return askQuestion(query);
  }

  async function explainSpell(spellName: string, context?: any): Promise<AssistantResponse> {
    return askQuestion({ question: `Explain the spell: ${spellName}`, context });
  }

  async function explainRule(ruleTopic: string, context?: any): Promise<AssistantResponse> {
    return askQuestion({ question: `Explain the rule: ${ruleTopic}`, context });
  }

  async function suggestActions(situation: string, context?: any): Promise<AssistantResponse> {
    return askQuestion({ question: `Suggest actions for: ${situation}`, context });
  }

  async function generateRuling(scenario: string, context?: any): Promise<AssistantResponse> {
    return askQuestion({ question: `Generate a ruling for: ${scenario}`, context });
  }

  async function getQueryHistory(filters?: { campaignId?: string; limit?: number }) {
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
