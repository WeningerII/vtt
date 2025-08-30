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
    sceneId?: string;
  };
}

export interface GeneratedContent {
  id: string;
  type: string;
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
    
    // if (!anthropicProvider) {
    //   throw new Error('Anthropic provider not configured. Set ANTHROPIC_API_KEY environment variable.');
    // }

    // const started = Date.now();

    // try {
    //   const result = await anthropicProvider.generateGameContent(
    //     request.type,
    //     request.context
    //   );

      // Store generation job in database
      const job = await prisma.generationJob.create({
        data: {
          type: 'CONTENT_GENERATION', // We'll need to add CONTENT_GENERATION type to schema
          status: 'SUCCEEDED',
          input: request as any,
          output: result.content as any,
        },
      });

      // Track provider call
      await prisma.providerCall.create({
        data: {
          jobId: job.id,
          provider: 'anthropic',
          model: result.model,
          costUSD: result.costUSD,
          latencyMs: result.latencyMs,
          success: true,
        },
      });

      return {
        id: job.id,
        type: request.type,
        content: result.content,
        metadata: {
          provider: 'anthropic',
          model: result.model,
          costUSD: result.costUSD,
          latencyMs: result.latencyMs,
          generatedAt: new Date(),
        },
      };
    } catch (error: any) {
      // Log failed generation
      const job = await prisma.generationJob.create({
        data: {
          type: 'CONTENT_GENERATION',
          status: 'FAILED',
          input: request as any,
          error: error.message,
        },
      });

      await prisma.providerCall.create({
        data: {
          jobId: job.id,
          provider: 'anthropic',
          model: null,
          costUSD: 0,
          latencyMs: Date.now() - started,
          success: false,
          error: error.message,
        },
      });

      throw error;
    }
  }

  async function generateNPC(context: ContentGenerationRequest['context']) {
    return generateContent({ type: 'npc', context });
  }

  async function generateLocation(context: ContentGenerationRequest['context']) {
    return generateContent({ type: 'location', context });
  }

  async function generateQuest(context: ContentGenerationRequest['context']) {
    return generateContent({ type: 'quest', context });
  }

  async function generateItem(context: ContentGenerationRequest['context']) {
    return generateContent({ type: 'item', context });
  }

  async function generateEncounter(context: {
    playerLevel: number;
    partySize: number;
    setting: string;
    difficulty: 'easy' | 'medium' | 'hard' | 'deadly';
    theme?: string;
    environment?: string;
  }) {
    const encounterContext = {
      ...context,
      additionalContext: `Generate a complete encounter for ${context.partySize} level ${context.playerLevel} characters. Include enemies, tactics, environment details, potential rewards, and scaling suggestions.`
    };

    // Using 'quest' type as a proxy for encounter generation
    // This could be updated to use a specific 'encounter' type if supported by the AI provider
    return generateContent({ type: 'quest', context: encounterContext });
  }

  async function generateCampaignContent(campaignId: string, contentType: 'npc' | 'location' | 'quest' | 'item') {
    // Get campaign context from database
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        scenes: true,
        members: {
          include: { user: true }
        }
      }
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const context = {
      setting: 'fantasy', // Could be derived from campaign settings
      theme: 'adventure',
      playerLevel: 5, // Could be calculated from campaign progress
      campaignId,
      additionalContext: `This content is for the campaign "${campaign.name}" with ${campaign.members.length} members.`
    };

    return generateContent({ type: contentType, context });
  }

  return {
    generateContent,
    generateNPC,
    generateLocation,
    generateQuest,
    generateItem,
    generateEncounter,
    generateCampaignContent,
  };
}
