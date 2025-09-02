/**
 * VTT-specific content generation utilities
 * Specialized methods for D&D 5e content creation using AI providers
 */

import {
  AIProvider,
  TextGenerationRequest,
  VTTContentRequest,
  VTTContentResult,
  AIContext
} from './types';

export interface VTTContentGeneratorOptions {
  defaultProvider: AIProvider;
  fallbackProviders?: AIProvider[];
  systemPrompts?: Record<string, string>;
}

export class VTTContentGenerator {
  private defaultProvider: AIProvider;
  private fallbackProviders: AIProvider[];
  private systemPrompts: Record<string, string>;

  constructor(options: VTTContentGeneratorOptions) {
    this.defaultProvider = options.defaultProvider;
    this.fallbackProviders = options.fallbackProviders || [];
    this.systemPrompts = {
      npc: `You are an expert D&D 5e game master and content creator. Generate high-quality, balanced NPCs that follow official D&D 5e rules. Always respond with valid JSON including: name, race, class, level, background, personality traits, ideals, bonds, flaws, and appropriate stat block.`,
      location: `You are an expert D&D 5e world builder. Create detailed, immersive locations with rich descriptions, notable features, inhabitants, secrets, and plot hooks. Always respond with valid JSON.`,
      quest: `You are an expert D&D 5e adventure writer. Design engaging quests with clear objectives, compelling backgrounds, memorable NPCs, balanced challenges, and appropriate rewards. Always respond with valid JSON.`,
      item: `You are an expert D&D 5e magic item designer. Create balanced, thematic magic items following official design principles. Include rarity, properties, lore, and mechanical effects. Always respond with valid JSON.`,
      encounter: `You are an expert D&D 5e encounter designer. Create balanced, tactical combat encounters with appropriate CR, environmental features, enemy tactics, and potential complications. Always respond with valid JSON.`,
      ...options.systemPrompts
    };
  }

  async generateNPC(
    context: VTTContentRequest['context'],
    options?: { 
      playerLevel?: number;
      role?: 'ally' | 'neutral' | 'enemy' | 'vendor' | 'quest_giver';
      detailLevel?: 'basic' | 'detailed' | 'full_stat_block';
    },
    ctx?: AIContext
  ): Promise<VTTContentResult> {
    const prompt = this.buildNPCPrompt(context, options);
    
    return this.generateContent('npc', prompt, ctx);
  }

  async generateLocation(
    context: VTTContentRequest['context'],
    options?: {
      locationType?: 'dungeon' | 'settlement' | 'wilderness' | 'building' | 'landmark';
      scale?: 'room' | 'building' | 'district' | 'settlement' | 'region';
      inhabitants?: boolean;
    },
    ctx?: AIContext
  ): Promise<VTTContentResult> {
    const prompt = this.buildLocationPrompt(context, options);
    
    return this.generateContent('location', prompt, ctx);
  }

  async generateQuest(
    context: VTTContentRequest['context'],
    options?: {
      questType?: 'main' | 'side' | 'personal' | 'faction' | 'exploration';
      structure?: 'linear' | 'branching' | 'sandbox' | 'investigation';
      duration?: 'short' | 'medium' | 'long' | 'campaign';
    },
    ctx?: AIContext
  ): Promise<VTTContentResult> {
    const prompt = this.buildQuestPrompt(context, options);
    
    return this.generateContent('quest', prompt, ctx);
  }

  async generateMagicItem(
    context: VTTContentRequest['context'],
    options?: {
      itemType?: 'weapon' | 'armor' | 'accessory' | 'consumable' | 'wondrous';
      rarity?: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary' | 'artifact';
      school?: 'abjuration' | 'conjuration' | 'divination' | 'enchantment' | 'evocation' | 'illusion' | 'necromancy' | 'transmutation';
    },
    ctx?: AIContext
  ): Promise<VTTContentResult> {
    const prompt = this.buildMagicItemPrompt(context, options);
    
    return this.generateContent('item', prompt, ctx);
  }

  async generateEncounter(
    context: VTTContentRequest['context'],
    options?: {
      encounterType?: 'combat' | 'social' | 'exploration' | 'puzzle' | 'mixed';
      environment?: 'indoor' | 'outdoor' | 'underground' | 'aquatic' | 'aerial' | 'planar';
      partySize?: number;
    },
    ctx?: AIContext
  ): Promise<VTTContentResult> {
    const prompt = this.buildEncounterPrompt(context, options);
    
    return this.generateContent('encounter', prompt, ctx);
  }

  async generateCampaignHook(
    context: VTTContentRequest['context'],
    options?: {
      scope?: 'local' | 'regional' | 'national' | 'planar' | 'cosmic';
      tone?: 'heroic' | 'gritty' | 'horror' | 'political' | 'exploration';
    },
    ctx?: AIContext
  ): Promise<VTTContentResult> {
    const prompt = `Create a compelling campaign hook for a ${context.setting || 'fantasy'} D&D campaign.
    
Context:
- Setting: ${context.setting || 'Standard Fantasy'}
- Theme: ${context.theme || 'Heroic Adventure'}
- Player Level: ${context.playerLevel || '1-3'}
- Scope: ${options?.scope || 'local'}
- Tone: ${options?.tone || 'heroic'}
${context.additionalContext ? `- Additional Context: ${context.additionalContext}` : ''}

Include:
- Opening scenario that draws characters together
- Central conflict or mystery
- Key NPCs and factions
- Potential story arcs (3-5 major beats)
- Environmental/political backdrop
- Player agency opportunities
- Scalable threats for campaign growth

Format as JSON with structured campaign information.`;

    return this.generateContent('quest', prompt, ctx);
  }

  private async generateContent(
    contentType: string,
    prompt: string,
    ctx?: AIContext
  ): Promise<VTTContentResult> {
    const providers = [this.defaultProvider, ...this.fallbackProviders];
    const context = ctx || {};
    
    for (const provider of providers) {
      try {
        const request: TextGenerationRequest = {
          prompt: prompt,
          maxTokens: 2000,
          temperature: 0.7,
          outputFormat: 'json'
        };

        const result = await provider.generateText!(request, context);
        
        let parsedContent;
        try {
          parsedContent = JSON.parse(result.text);
        } catch {
          // If JSON parsing fails, return structured fallback
          parsedContent = {
            type: contentType,
            raw: result.text,
            parsed: false,
            error: 'Failed to parse JSON response'
          };
        }

        return {
          provider: result.provider,
          model: result.model,
          costUSD: result.costUSD,
          latencyMs: result.latencyMs,
          tokensUsed: result.tokensUsed || { input: 0, output: 0, total: 0 },
          content: parsedContent,
          metadata: {}
        };
      } catch (error) {
        console.warn(`Provider ${provider.name} failed for ${contentType}:`, error);
        continue;
      }
    }
    
    throw new Error(`All providers failed to generate ${contentType} content`);
  }

  private buildNPCPrompt(
    context: VTTContentRequest['context'],
    options?: { 
      playerLevel?: number;
      role?: string;
      detailLevel?: string;
    }
  ): string {
    return `Create a detailed D&D 5e NPC for a ${context.setting || 'fantasy'} campaign.

Context:
- Setting: ${context.setting || 'Standard Fantasy'}
- Theme: ${context.theme || 'Neutral'}
- Player Level: ${context.playerLevel || options?.playerLevel || 5}
- NPC Role: ${options?.role || 'general'}
- Detail Level: ${options?.detailLevel || 'detailed'}
${context.additionalContext ? `- Additional Context: ${context.additionalContext}` : ''}

${options?.detailLevel === 'full_stat_block' ? 
'Include complete D&D 5e stat block with AC, HP, saves, skills, damage resistances/immunities, senses, languages, CR, and actions.' :
'Include personality, appearance, motivations, and key relationships.'}

Format as JSON with all required NPC information.`;
  }

  private buildLocationPrompt(
    context: VTTContentRequest['context'],
    options?: {
      locationType?: string;
      scale?: string;
      inhabitants?: boolean;
    }
  ): string {
    return `Design a detailed ${options?.locationType || 'location'} for a ${context.setting || 'fantasy'} D&D campaign.

Context:
- Setting: ${context.setting || 'Standard Fantasy'}
- Theme: ${context.theme || 'Neutral'}
- Location Type: ${options?.locationType || 'general'}
- Scale: ${options?.scale || 'building'}
- Include Inhabitants: ${options?.inhabitants !== false}
${context.additionalContext ? `- Additional Context: ${context.additionalContext}` : ''}

Include:
- Detailed description and atmosphere
- Key areas/rooms with features
- Notable NPCs (if applicable)
- Secrets and hidden elements
- Plot hooks and adventure opportunities
- Hazards or challenges
- Treasure or resources

Format as JSON with structured location information.`;
  }

  private buildQuestPrompt(
    context: VTTContentRequest['context'],
    options?: {
      questType?: string;
      structure?: string;
      duration?: string;
    }
  ): string {
    return `Create a ${options?.questType || 'main'} quest for level ${context.playerLevel || 5} D&D characters.

Context:
- Setting: ${context.setting || 'Standard Fantasy'}
- Theme: ${context.theme || 'Heroic Adventure'}
- Quest Type: ${options?.questType || 'main'}
- Structure: ${options?.structure || 'branching'}
- Duration: ${options?.duration || 'medium'}
- Difficulty: ${context.difficulty || 'medium'}
${context.additionalContext ? `- Additional Context: ${context.additionalContext}` : ''}

Include:
- Clear objective and motivation
- Background and context
- Key NPCs and their roles
- Major story beats/encounters
- Branching paths and player choices
- Challenges appropriate for level ${context.playerLevel || 5}
- Meaningful rewards (XP, gold, items, story)
- Potential complications

Format as JSON with structured quest information.`;
  }

  private buildMagicItemPrompt(
    context: VTTContentRequest['context'],
    options?: {
      itemType?: string;
      rarity?: string;
      school?: string;
    }
  ): string {
    return `Design a magic ${options?.itemType || 'item'} for level ${context.playerLevel || 5} D&D characters.

Context:
- Setting: ${context.setting || 'Standard Fantasy'}
- Theme: ${context.theme || 'Neutral'}
- Item Type: ${options?.itemType || 'wondrous'}
- Rarity: ${options?.rarity || 'uncommon'}
- Magic School: ${options?.school || 'any'}
- Player Level: ${context.playerLevel || 5}
${context.additionalContext ? `- Additional Context: ${context.additionalContext}` : ''}

Include:
- Item name and physical description
- Rarity and attunement requirements
- Mechanical properties and effects
- Activation method and limitations
- Rich lore and history
- Potential drawbacks or costs
- Appropriate power level for party

Follow D&D 5e magic item design principles. Format as JSON.`;
  }

  private buildEncounterPrompt(
    context: VTTContentRequest['context'],
    options?: {
      encounterType?: string;
      environment?: string;
      partySize?: number;
    }
  ): string {
    return `Create a ${options?.encounterType || 'combat'} encounter for ${options?.partySize || 4} level ${context.playerLevel || 5} D&D characters.

Context:
- Setting: ${context.setting || 'Standard Fantasy'}
- Encounter Type: ${options?.encounterType || 'combat'}
- Environment: ${options?.environment || 'outdoor'}
- Party Size: ${options?.partySize || 4}
- Player Level: ${context.playerLevel || 5}
- Difficulty: ${context.difficulty || 'medium'}
${context.additionalContext ? `- Additional Context: ${context.additionalContext}` : ''}

Include:
- Encounter setup and context
- Enemy composition with appropriate CR
- Environmental features and hazards
- Tactical considerations and enemy strategy
- Potential complications or twists
- Success/failure outcomes
- Treasure and rewards
- Scalable elements for different party sizes

Calculate appropriate encounter difficulty using D&D 5e guidelines. Format as JSON.`;
  }
}
