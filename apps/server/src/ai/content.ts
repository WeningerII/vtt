/**
 * AI-driven content generation service integrating Anthropic's generateGameContent
 */

import { PrismaClient } from "@prisma/client";
import { createAIServices } from "./service";
import { getErrorMessage } from "../utils/errors";

type ContentContext = ContentGenerationRequest["context"];

export interface ContentGenerationRequest {
  type: "npc" | "location" | "quest" | "item" | "encounter";
  context: {
    setting?: string;
    theme?: string;
    difficulty?: string;
    playerLevel?: number;
    additionalContext?: string;
    campaignId?: string;
    challengeRating?: number;
    timestamp?: string;
    [key: string]: unknown; // Allow additional properties for extensibility
  };
}

export interface GeneratedContent {
  content: unknown;
  metadata: {
    provider: string;
    model: string;
    costUSD: number;
    latencyMs: number;
    generatedAt: Date;
  };
}

export function createContentGenerationService(prisma: PrismaClient) {
  // Initialize AI services with router and provider management
  const aiServices = createAIServices(prisma);
  const aiRouter = aiServices.router;

  const CONTENT_GENERATION_PROMPTS = {
    npc: `Generate a detailed D&D 5e NPC with the following structure:
- Name and race/species
- Class/profession and background
- Personality traits and mannerisms  
- Physical description
- Motivations and goals
- Stat block (AC, HP, abilities)
- Notable equipment or spells
- Roleplay notes for DMs

Create a memorable character that fits the context provided.`,

    location: `Generate a detailed D&D 5e location with:
- Name and type of location
- Physical description and atmosphere
- Notable features and landmarks
- Potential encounters or hazards
- Hidden secrets or special properties
- Connections to other locations
- Adventure hooks and plot potential
- Environmental details

Make it engaging and full of possibilities for exploration.`,

    quest: `Generate a D&D 5e quest/adventure with:
- Quest title and type (main/side quest)
- Background and setup
- Clear objectives and goals  
- NPCs involved (quest giver, allies, antagonists)
- Locations and scenes
- Challenges and obstacles
- Potential rewards (XP, gold, items, story)
- Multiple solution paths
- Scaling suggestions for different party levels

Design a compelling adventure with meaningful choices.`,

    item: `Generate a D&D 5e magic item with:
- Item name and type
- Rarity and attunement requirements
- Physical description and appearance
- Magical properties and mechanics
- Activation method and limitations
- History and lore
- Suggested value and availability
- Plot hooks and significance

Create something unique that enhances gameplay.`,
  };

  const VALID_CONTENT_TYPES = ["npc", "location", "quest", "item", "encounter"] as const;
  type ContentType = (typeof VALID_CONTENT_TYPES)[number];

  async function generateContent(request: ContentGenerationRequest): Promise<GeneratedContent> {
    const startTime = Date.now();

    try {
      // Check if AI router has available providers
      const providers = aiServices.listProviders();
      const hasAIProviders = providers.length > 0 && providers.some((p) => p.name !== "dummy");

      if (hasAIProviders) {
        const prompt =
          CONTENT_GENERATION_PROMPTS[request.type] || "Generate appropriate game content.";
        const contextInfo = buildContextPrompt(request);

        const response = await aiRouter.generateText({
          prompt: `${prompt}\n\nGenerate content for: ${contextInfo}`,
          maxTokens: 1500,
          temperature: 0.7,
        });

        // Log the generation for analytics
        const inputData = JSON.parse(
          JSON.stringify({ type: request.type, context: request.context }),
        ) as any;
        const outputData = JSON.parse(JSON.stringify({ content: response.text })) as any;

        await prisma.generationJob.create({
          data: {
            type: "TEXT_TO_IMAGE",
            status: "SUCCEEDED",
            input: inputData,
            output: outputData,
          },
        });

        return {
          content: parseAIResponse(response.text, request.type),
          metadata: {
            provider: response.provider || "ai-router",
            model: response.model || "unknown",
            costUSD: response.costUSD || 0,
            latencyMs: Date.now() - startTime,
            generatedAt: new Date(),
          },
        };
      }

      // Fallback to rule-based generation
      const content = generateFallbackContent(request);

      return {
        content,
        metadata: {
          provider: "fallback",
          model: "rule-based",
          costUSD: 0,
          latencyMs: Date.now() - startTime,
          generatedAt: new Date(),
        },
      };
    } catch (error: unknown) {
      throw new Error(`Content generation failed: ${getErrorMessage(error)}`);
    }
  }

  function buildContextPrompt(request: ContentGenerationRequest): string {
    const { context } = request;
    return `Context for ${request.type} generation:
- Setting: ${context.setting || "Fantasy"}
- Theme: ${context.theme || "Adventure"}
- Difficulty: ${context.difficulty || "Medium"}
- Player Level: ${context.playerLevel || "Unknown"}
- Campaign ID: ${context.campaignId || "N/A"}
${context.additionalContext ? `- Additional Context: ${context.additionalContext}` : ""}

Generate appropriate content that fits this context and enhances the gaming experience.`;
  }

  function parseAIResponse(response: string, type: string): unknown {
    try {
      // Try to parse as JSON first
      return JSON.parse(response) as unknown;
    } catch {
      // If not JSON, return structured text response
      return {
        type,
        description: response,
        generated: true,
        aiGenerated: true,
      };
    }
  }

  function generateFallbackContent(request: ContentGenerationRequest): Record<string, unknown> {
    const { type, context } = request;

    switch (type) {
      case "npc":
        return generateNPCContent(context);
      case "location":
        return generateLocationContent(context);
      case "quest":
        return generateQuestContent(context);
      case "item":
        return generateItemContent(context);
      default:
        return { name: "Generated Content", description: "Basic generated content" };
    }
  }

  function generateNPCContent(_context: ContentContext): Record<string, unknown> {
    const names = ["Gareth", "Luna", "Thorin", "Zara", "Kael", "Vera"];
    const classes = ["Merchant", "Guard", "Scholar", "Innkeeper", "Blacksmith"];
    const personalities = ["Friendly", "Gruff", "Mysterious", "Cheerful", "Suspicious"];

    return {
      name: names[Math.floor(Math.random() * names.length)],
      class: classes[Math.floor(Math.random() * classes.length)],
      personality: personalities[Math.floor(Math.random() * personalities.length)],
      description: "A notable figure in the local area with their own motivations and connections.",
      level: Math.floor(Math.random() * 10) + 1,
      hitPoints: 25 + Math.floor(Math.random() * 50),
      armorClass: 12 + Math.floor(Math.random() * 6),
    };
  }

  function generateLocationContent(context: ContentContext): Record<string, unknown> {
    const locations = [
      "Ancient Ruins",
      "Hidden Grove",
      "Abandoned Tower",
      "Crystal Cave",
      "Misty Swamp",
    ];
    const features = [
      "Strange markings",
      "Magical aura",
      "Hidden passages",
      "Dangerous wildlife",
      "Valuable resources",
    ];

    return {
      name: locations[Math.floor(Math.random() * locations.length)],
      description: "An intriguing location that holds secrets and opportunities for adventure.",
      features: [features[Math.floor(Math.random() * features.length)]],
      difficulty: context.difficulty || "moderate",
      encounters: ["Wildlife", "Environmental hazards"],
      treasures: ["Minor magical item", "Gold coins"],
    };
  }

  function generateQuestContent(context: ContentContext): Record<string, unknown> {
    const questTypes = ["Rescue", "Retrieve", "Investigate", "Escort", "Eliminate"];
    const objectives = [
      "Find the missing person",
      "Recover the stolen artifact",
      "Uncover the mystery",
      "Protect the caravan",
      "Defeat the threat",
    ];

    return {
      title: `${questTypes[Math.floor(Math.random() * questTypes.length)]} Mission`,
      description: "An important task that requires skilled adventurers to complete.",
      objective: objectives[Math.floor(Math.random() * objectives.length)],
      difficulty: context.difficulty || "moderate",
      reward: {
        gold: 100 + Math.floor(Math.random() * 400),
        experience: 200 + Math.floor(Math.random() * 800),
        items: ["Potion of Healing"],
      },
      timeLimit: "7 days",
    };
  }

  function generateItemContent(_context: ContentContext): Record<string, unknown> {
    const itemTypes = ["Weapon", "Armor", "Potion", "Scroll", "Trinket"];
    const rarities = ["Common", "Uncommon", "Rare"];
    const properties = ["Magical", "Masterwork", "Ancient", "Blessed", "Enchanted"];

    return {
      name: `${properties[Math.floor(Math.random() * properties.length)]} ${itemTypes[Math.floor(Math.random() * itemTypes.length)]}`,
      type: itemTypes[Math.floor(Math.random() * itemTypes.length)],
      rarity: rarities[Math.floor(Math.random() * rarities.length)],
      description: "A useful item that could aid adventurers in their quests.",
      value: 50 + Math.floor(Math.random() * 450),
      properties: ["Durable", "Well-crafted"],
    };
  }

  async function generateNPC(context: ContentContext) {
    return generateContent({ type: "npc", context });
  }

  async function generateLocation(context: ContentContext) {
    return generateContent({ type: "location", context });
  }

  async function generateQuest(context: ContentContext) {
    return generateContent({ type: "quest", context });
  }

  async function generateItem(context: ContentContext) {
    return generateContent({ type: "item", context });
  }

  async function listGenerationHistory(_filters?: {
    type?: ContentGenerationRequest["type"];
    campaignId?: string;
    limit?: number;
  }) {
    // Basic implementation - in production this would query the database
    return [];
  }

  async function generateEncounter(context: {
    playerLevel: number;
    partySize: number;
    setting: string;
    difficulty: string;
    theme?: string;
    environment?: string;
  }) {
    // Generate encounter based on party parameters
    const encounterContent = await generateContent({
      type: "encounter",
      context: {
        ...context,
        challengeRating: calculateChallengeRating(
          context.playerLevel,
          context.partySize,
          context.difficulty,
        ),
      },
    });

    return {
      ...encounterContent,
      enemies: [
        {
          name: "Goblin Warrior",
          quantity: Math.max(1, Math.floor(context.partySize * 0.75)),
          cr: "1/4",
        },
      ],
      environment: context.environment || "dungeon",
      difficulty: context.difficulty,
      rewards: {
        xp: 100 * context.partySize,
        gold: 50 * context.partySize,
      },
    };
  }

  function isValidContentType(value: string): value is ContentType {
    return (VALID_CONTENT_TYPES as readonly string[]).includes(value);
  }

  async function generateCampaignContent(campaignId: string, contentType: string) {
    if (!isValidContentType(contentType)) {
      throw new Error(
        `Invalid content type: ${contentType}. Must be one of: ${VALID_CONTENT_TYPES.join(", ")}`,
      );
    }

    return generateContent({
      type: contentType,
      context: {
        campaignId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  function calculateChallengeRating(
    playerLevel: number,
    partySize: number,
    difficulty: string,
  ): number {
    const baseRating = playerLevel;
    const partyModifier = Math.log2(partySize);
    const difficultyModifiers: Record<string, number> = {
      easy: -2,
      medium: 0,
      hard: 2,
      deadly: 4,
    };

    return Math.max(0.25, baseRating + partyModifier + (difficultyModifiers[difficulty] || 0));
  }

  return {
    generateContent,
    generateNPC,
    generateLocation,
    generateQuest,
    generateItem,
    generateEncounter,
    generateCampaignContent,
    listGenerationHistory,
  };
}
