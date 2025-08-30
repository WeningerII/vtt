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
    // Temporarily disabled due to build issues
    throw new Error("AI Assistant temporarily disabled due to AI provider build issues");
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
    // Temporarily disabled due to build issues
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
