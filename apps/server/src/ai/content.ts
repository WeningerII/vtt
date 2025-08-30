/**
 * AI-driven content generation service integrating Anthropic's generateGameContent
 */

import { PrismaClient } from "@prisma/client";
// import { AnthropicProvider } from "@vtt/ai"; // Temporarily disabled due to build issues

export interface ContentGenerationRequest {
  type: 'npc' | 'location' | 'quest' | 'item';
  context: {
    setting?: string;
    theme?: string;
    difficulty?: string;
    playerLevel?: number;
    additionalContext?: string;
    campaignId?: string;
  };
}

export interface GeneratedContent {
  content: any;
  metadata: {
    provider: string;
    model: string;
    costUSD: number;
    latencyMs: number;
    generatedAt: Date;
  };
}

export function createContentGenerationService(prisma: PrismaClient) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  // let anthropicProvider: AnthropicProvider | null = null;

  // if (anthropicKey && anthropicKey.trim().length > 0) {
  //   anthropicProvider = new AnthropicProvider({ apiKey: anthropicKey });
  // }

  async function generateContent(request: ContentGenerationRequest): Promise<GeneratedContent> {
    // Temporarily disabled due to build issues
    throw new Error('Content generation temporarily disabled due to AI provider build issues');
  }

  async function generateNPC(context: any) {
    return generateContent({ type: 'npc', context });
  }

  async function generateLocation(context: any) {
    return generateContent({ type: 'location', context });
  }

  async function generateQuest(context: any) {
    return generateContent({ type: 'quest', context });
  }

  async function generateItem(context: any) {
    return generateContent({ type: 'item', context });
  }

  async function listGenerationHistory(filters?: {
    type?: ContentGenerationRequest['type'];
    campaignId?: string;
    limit?: number;
  }) {
    // Temporarily disabled due to build issues
    return [];
  }

  return {
    generateContent,
    generateNPC,
    generateLocation,
    generateQuest,
    generateItem,
    listGenerationHistory,
  };
}
