import { EventEmitter } from 'events';
import { NPCBehaviorSystem, NPCActor, BehaviorAction, BehaviorContext, ActionResult, NPCPersonality } from './NPCBehaviorSystem';
import { CampaignAssistant, NPC, CampaignContext } from './campaign/CampaignAssistant';
import { BehaviorTree, BehaviorTreeBuilder, NodeStatus, ActionNode, Blackboard } from './BehaviorTree';
import { AIProvider } from './types';
import { logger } from '@vtt/logging';

export interface InteractionHistory {
  playerId: string;
  interaction: string;
  response: string;
  timestamp: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface PersonalityEvolution {
  traits: Record<string, number>;
  motivations: string[];
  fears: string[];
  changes: string[];
}

export interface NPCResponse {
  response: string;
  actions: ActionResult[];
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface DynamicNPCConfig {
  aiProvider: AIProvider;
  campaignAssistant: CampaignAssistant;
  behaviorSystem: NPCBehaviorSystem;
  updateInterval: number;
  maxContextLength: number;
  creativityLevel: number; // 0-1, higher = more creative/unpredictable
}

export interface NPCBehaviorContext {
  npc: NPCActor;
  gameContext: BehaviorContext;
  campaignContext: CampaignContext;
  recentEvents: string[];
  playerActions: Array<{
    playerId: string;
    action: string;
    target?: string;
    timestamp: number;
  }>;
}

export interface GeneratedBehavior {
  id: string;
  name: string;
  description: string;
  reasoning: string;
  priority: number;
  action: BehaviorAction;
  behaviorTree?: BehaviorTree;
  dialogue?: string[];
  emotions?: string;
  goals?: string[];
}

/**
 * Dynamic NPC Manager - Connects AI content generation to NPC behavior system
 * Generates intelligent, context-aware NPC behaviors using AI
 */
export class DynamicNPCManager extends EventEmitter {
  private config: DynamicNPCConfig;
  private npcBehaviorTrees = new Map<string, BehaviorTree>();
  private npcContextHistory = new Map<string, string[]>();
  private behaviorCache = new Map<string, GeneratedBehavior[]>();
  private updateTimer?: NodeJS.Timeout;

  constructor(config: DynamicNPCConfig) {
    super();
    this.config = config;
    this.setMaxListeners(100);
    this.startPeriodicUpdates();
  }

  /**
   * Generate dynamic behavior for an NPC based on context
   */
  async generateNPCBehavior(npcId: string, context: NPCBehaviorContext): Promise<GeneratedBehavior | null> {
    try {
      const npc = context.npc;
      const prompt = this.buildBehaviorPrompt(context);
      
      if (!this.config.aiProvider.generateText) {
        logger.warn(`AI provider ${this.config.aiProvider.name} does not support text generation`);
        return null;
      }
      
      const response = await this.config.aiProvider.generateText({
        prompt,
        maxTokens: 800,
        temperature: this.config.creativityLevel,
        model: 'claude-3-sonnet'
      });

      if (!response || !response.text) {
        logger.warn(`Failed to generate behavior for NPC ${npcId}`);
        return null;
      }

      const behavior = this.parseBehaviorResponse(response.text, npc);
      if (behavior) {
        // Cache the behavior for similar contexts
        const contextKey = this.generateContextKey(context);
        this.cacheBehavior(contextKey, behavior);
        
        this.emit('behaviorGenerated', { npcId, behavior, context });
        return behavior;
      }

      return null;
    } catch (error) {
      logger.error(`Error generating NPC behavior for ${npcId}:`, error as any);
      return null;
    }
  }

  /**
   * Process player interaction with an NPC
   */
  async processPlayerInteraction(npcId: string, playerId: string, playerAction: string, gameState: any, campaignContext: any): Promise<NPCResponse> {
    try {
      const npc = this.config.behaviorSystem.getNPC(npcId);
      if (!npc) {
        logger.warn(`NPC ${npcId} not found for player interaction`);
        return {
          response: "The character doesn't respond.",
          actions: []
        };
      }

      const prompt = this.buildContextualResponsePrompt(npc, playerAction, gameState, campaignContext);
      
      if (!this.config.aiProvider.generateText) {
        logger.warn(`AI provider ${this.config.aiProvider.name} does not support text generation`);
        return {
          response: `${npc.name} nods silently.`,
          actions: []
        };
      }
      
      const response = await this.config.aiProvider.generateText({
        prompt,
        maxTokens: 300,
        temperature: Math.min(1.0, this.config.creativityLevel + 0.1),
        model: 'claude-3-sonnet'
      });

      if (response && response.text) {
        const npcResponse = this.parseInteractionResponse(response.text);
        
        // Update NPC context history
        this.addToNPCHistory(npcId, `Player (${playerId}): ${playerAction} -> ${npcResponse.response}`);
        
        // Adjust relationship based on interaction
        const sentimentAdjustment = this.calculateSentimentAdjustment(npcResponse.response);
        const currentRelationship = npc.personality.relationships.get(playerId) || 0;
        npc.personality.relationships.set(playerId, Math.max(-1, Math.min(1, currentRelationship + sentimentAdjustment)));
        
        this.emit('playerInteractionProcessed', { npcId, playerId, playerAction, npcResponse });
        return npcResponse;
      }

      return {
        response: `${npc.name} looks confused.`,
        actions: []
      };
    } catch (error) {
      logger.error(`Error processing player interaction with NPC ${npcId}:`, error as any);
      return {
        response: "The character seems distracted.",
        actions: []
      };
    }
  }

  /**
   * Generate dynamic dialogue for an NPC
   */
  async generateNPCDialogue(npcId: string, context: NPCBehaviorContext, topic?: string): Promise<string[]> {
    try {
      const prompt = this.buildDialoguePrompt(context, topic);
      
      if (!this.config.aiProvider.generateText) {
        logger.warn(`AI provider ${this.config.aiProvider.name} does not support text generation`);
        return [''];
      }
      
      const response = await this.config.aiProvider.generateText({
        prompt,
        maxTokens: 400,
        temperature: Math.min(1.0, this.config.creativityLevel + 0.2),
        model: 'claude-3-sonnet'
      });

      if (response && response.text) {
        const dialogue = this.parseDialogueResponse(response.text);
        this.emit('dialogueGenerated', { npcId, dialogue, topic });
        return dialogue;
      }

      return [`${context.npc.name} remains silent.`];
    } catch (error) {
      logger.error(`Error generating dialogue for NPC ${npcId}:`, error as any);
      return [`${context.npc.name} seems distracted.`];
    }
  }

  /**
   * Update NPC personality based on experiences
   */
  async evolveNPCPersonality(npcId: string, interactions: InteractionHistory[]): Promise<PersonalityEvolution | null> {
    try {
      const npc = this.config.behaviorSystem.getNPC(npcId);
      if (!npc) {
        logger.warn(`NPC ${npcId} not found for personality evolution`);
        return null;
      }

      const prompt = this.buildPersonalityEvolutionPrompt(npc, interactions);
      
      if (!this.config.aiProvider.generateText) {
        logger.warn(`AI provider ${this.config.aiProvider.name} does not support text generation`);
        return null;
      }
      
      const response = await this.config.aiProvider.generateText({
        prompt,
        maxTokens: 600,
        temperature: this.config.creativityLevel * 0.8,
        model: 'claude-3-sonnet'
      });

      if (response && response.text) {
        const evolution = this.parsePersonalityEvolutionResponse(response.text, npc.personality);
        if (evolution) {
          npc.personality.traits = { ...npc.personality.traits, ...evolution.traits };
          npc.personality.motivations = evolution.motivations;
          npc.personality.fears = evolution.fears;
          this.emit('personalityEvolved', { npcId, evolution, interactions });
          return evolution;
        }
      }

      return null;
    } catch (error) {
      logger.error(`Error evolving personality for NPC ${npcId}:`, error as any);
      return null;
    }
  }

  /**
   * Create a behavior tree for complex NPC behaviors
   */
  async createDynamicBehaviorTree(npcId: string, context: NPCBehaviorContext): Promise<BehaviorTree | null> {
    try {
      const behaviors = await this.generateComplexBehaviors(npcId, context);
      if (!behaviors || behaviors.length === 0) {return null;}

      const blackboard = new Blackboard();
      blackboard.set('npcId', npcId);
      blackboard.set('context', context);

      const builder = new BehaviorTreeBuilder(blackboard);
      
      // Build a selector tree with generated behaviors
      builder.selector('root');
      
      for (const behavior of behaviors) {
        builder.action(behavior.name, () => {
          return this.executeDynamicBehavior(behavior, context);
        });
      }

      const root = builder.build();
      if (root) {
        const tree = new BehaviorTree();
        tree.setRoot(root);
        
        this.npcBehaviorTrees.set(npcId, tree);
        this.emit('behaviorTreeCreated', { npcId, behaviors: behaviors.length });
        
        return tree;
      }

      return null;
    } catch (error) {
      logger.error(`Error creating behavior tree for NPC ${npcId}:`, error as any);
      return null;
    }
  }

  /**
   * Process player interaction with NPC
   */
  async generateContextualResponse(npcId: string, playerAction: string, gameState: any): Promise<NPCResponse | null> {
    try {
      const npc = this.config.behaviorSystem.getNPC(npcId);
      if (!npc) {
        logger.warn(`NPC ${npcId} not found for contextual response`);
        return null;
      }

      // Get campaign context for richer responses
      const campaignContext = (this.config.campaignAssistant as any).context || {};
      
      const prompt = this.buildContextualResponsePrompt(npc, playerAction, gameState, campaignContext);
      
      if (!this.config.aiProvider.generateText) {
        logger.warn(`AI provider ${this.config.aiProvider.name} does not support text generation`);
        return null;
      }
      
      const response = await this.config.aiProvider.generateText({
        prompt,
        maxTokens: 500,
        temperature: this.config.creativityLevel,
        model: 'claude-3-sonnet'
      });

      if (response && response.text) {
        const parsed = this.parseInteractionResponse(response.text);
        
        // Update NPC's memory and relationships
        const relationship = npc.personality.relationships.get('player') || 0;
        const sentimentAdjustment = this.calculateSentimentAdjustment(parsed.response);
        npc.personality.relationships.set('player', Math.max(-1, Math.min(1, relationship + sentimentAdjustment)));

        this.addToNPCHistory(npcId, `${npc.name}: ${parsed.response}`);
        this.emit('playerInteraction', { npcId, playerAction, response: parsed.response });

        return parsed;
      }

      return {
        response: `${npc.name} nods thoughtfully.`,
        actions: []
      };
    } catch (error) {
      logger.error(`Error processing player interaction for NPC ${npcId}:`, error as any);
      const npc = this.config.behaviorSystem.getNPC(npcId);
      return {
        response: `${npc?.name || 'NPC'} seems confused.`,
        actions: []
      };
    }
  }

  private buildBehaviorPrompt(context: NPCBehaviorContext): string {
    const { npc, gameContext, campaignContext, recentEvents } = context;
    const history = this.npcContextHistory.get(npc.id) || [];

    return `You are ${npc.name}, an NPC in a tabletop RPG campaign. Generate your next behavior based on the current situation.

Character Profile:
- Name: ${npc.name}
- Role: ${npc.personality.name}
- Traits: Aggression ${npc.personality.aggression}, Courage ${npc.personality.traits.courage}, Intelligence ${npc.personality.intelligence}
- Motivations: ${npc.personality.motivations.join(', ')}
- Current Mood: ${npc.behaviorState.mood}
- Health: ${npc.stats.health}/${npc.stats.maxHealth}

Current Situation:
- Location: ${campaignContext.currentLocation}
- In Combat: ${gameContext.gameState.inCombat}
- Time: ${gameContext.gameState.timeOfDay}
- Visible Entities: ${gameContext.visibleEntities.map(e => `${e.type} at distance ${e.distance}`).join(', ')}
- Recent Events: ${recentEvents.join('; ')}

Recent History:
${history.slice(-3).join('\n')}

Generate a behavior in this JSON format:
{
  "name": "behavior name",
  "description": "what the NPC does",
  "reasoning": "why this behavior makes sense",
  "priority": 0.8,
  "actionType": "movement|combat|social|utility",
  "dialogue": ["optional dialogue lines"],
  "emotions": "current emotional state",
  "duration": 2000
}`;
  }

  private buildDialoguePrompt(context: NPCBehaviorContext, topic?: string): string {
    const { npc, campaignContext } = context;
    const history = this.npcContextHistory.get(npc.id) || [];

    return `Generate dialogue for ${npc.name} in a tabletop RPG campaign.

Character: ${npc.name} (${npc.personality.name})
- Personality: ${JSON.stringify(npc.personality.traits)}
- Mood: ${npc.behaviorState.mood}
- Location: ${campaignContext.currentLocation}
${topic ? `- Topic: ${topic}` : ''}

Recent Conversation:
${history.slice(-5).join('\n')}

Generate 1-3 dialogue options that fit the character and situation. Return as JSON array:
["dialogue line 1", "dialogue line 2", "dialogue line 3"]`;
  }

  private buildPersonalityEvolutionPrompt(npc: NPCActor, interactions: InteractionHistory[]): string {
    const experiences = interactions.map(i => `${i.interaction} -> ${i.response} (${i.sentiment})`);
    return this.buildPersonalityEvolutionPromptFromExperiences(npc.personality, experiences);
  }

  private buildPersonalityEvolutionPromptFromExperiences(personality: NPCPersonality, experiences: string[]): string {
    return `Evolve the personality of ${personality.name} based on recent experiences.

Current Personality:
- Traits: ${JSON.stringify(personality.traits)}  
- Motivations: ${personality.motivations.join(', ')}
- Fears: ${personality.fears.join(', ')}

Recent Experiences:
${experiences.join('\n')}

Return updated personality in JSON format with same structure, making subtle changes based on experiences:
{
  "traits": { "aggression": 0.5, "curiosity": 0.7, ... },
  "motivations": ["updated motivations"],
  "fears": ["updated fears"]
}`;
  }

  private buildContextualResponsePrompt(npc: NPCActor, playerAction: string, gameState: any, campaignContext: any): string {
    const relationship = npc.personality.relationships.get('player') || 0;
    const history = this.npcContextHistory.get(npc.id) || [];

    return `${npc.name} is interacting with a player character.

Character: ${npc.name}
- Relationship with player: ${relationship > 0.3 ? 'friendly' : relationship < -0.3 ? 'hostile' : 'neutral'}
- Mood: ${npc.behaviorState.mood}
- Recent conversation: ${history.slice(-3).join('; ')}
- Location: ${campaignContext.currentLocation || 'unknown'}

Player action: "${playerAction}"

Generate a response and any actions. Return JSON:
{
  "response": "what the NPC says",
  "actions": [{"type": "action_type", "description": "what they do"}],
  "sentiment": "positive|neutral|negative"
}`;
  }

  private async generateComplexBehaviors(npcId: string, context: NPCBehaviorContext): Promise<GeneratedBehavior[]> {
    const mainBehavior = await this.generateNPCBehavior(npcId, context);
    if (!mainBehavior) {return [];}
    
    return [mainBehavior];
  }

  private executeDynamicBehavior(behavior: GeneratedBehavior, context: NPCBehaviorContext): NodeStatus {
    try {
      // Execute the behavior action
      behavior.action.execute(context.npc, context.gameContext);
      return NodeStatus.SUCCESS;
    } catch (error) {
      logger.error('Error executing dynamic behavior:', error as any);
      return NodeStatus.FAILURE;
    }
  }

  private parseBehaviorResponse(response: string, npc: NPCActor): GeneratedBehavior | null {
    try {
      const parsed = JSON.parse(response);
      
      const action: BehaviorAction = {
        id: `dynamic_${Date.now()}`,
        type: parsed.actionType || 'utility',
        name: parsed.name,
        description: parsed.description,
        execute: async (_npc: NPCActor, _context: BehaviorContext): Promise<ActionResult> => ({
          success: true,
          message: parsed.description,
          duration: parsed.duration || 2000
        }),
        canExecute: () => true,
        priority: parsed.priority || 0.5
      };

      return {
        id: action.id,
        name: parsed.name,
        description: parsed.description,
        reasoning: parsed.reasoning,
        priority: parsed.priority || 0.5,
        action,
        dialogue: parsed.dialogue,
        emotions: parsed.emotions
      };
    } catch (error) {
      logger.warn('Failed to parse behavior response:', error as any);
      return null;
    }
  }

  private parseDialogueResponse(response: string): string[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [response];
    } catch {
      return [response];
    }
  }

  private parsePersonalityEvolutionResponse(response: string, currentPersonality: NPCPersonality): PersonalityEvolution | null {
    try {
      const parsed = JSON.parse(response);
      return {
        traits: { ...currentPersonality.traits, ...parsed.traits },
        motivations: parsed.motivations || currentPersonality.motivations,
        fears: parsed.fears || currentPersonality.fears,
        changes: parsed.changes || []
      };
    } catch (error) {
      logger.warn('Failed to parse personality evolution response:', error as any);
      return null;
    }
  }

  private parseInteractionResponse(response: string): NPCResponse {
    try {
      const parsed = JSON.parse(response);
      return {
        response: parsed.response,
        actions: parsed.actions?.map((action: any) => ({
          success: true,
          message: action.description,
          effects: [{ type: action.type, target: '', value: action.description }]
        })) || [],
        sentiment: parsed.sentiment
      };
    } catch {
      return { response, actions: [], sentiment: 'neutral' };
    }
  }

  private generateContextKey(context: NPCBehaviorContext): string {
    return `${context.npc.id}_${context.npc.behaviorState.mood}_${context.gameContext.gameState.inCombat}`;
  }

  private cacheBehavior(contextKey: string, behavior: GeneratedBehavior): void {
    const cached = this.behaviorCache.get(contextKey) || [];
    cached.push(behavior);
    if (cached.length > 5) {cached.shift();} // Keep only last 5
    this.behaviorCache.set(contextKey, cached);
  }

  private addToNPCHistory(npcId: string, event: string): void {
    const history = this.npcContextHistory.get(npcId) || [];
    history.push(event);
    if (history.length > 20) {history.shift();} // Keep only last 20 events
    this.npcContextHistory.set(npcId, history);
  }

  private calculateSentimentAdjustment(response: string): number {
    // Simple sentiment analysis - in production, use proper NLP
    const positive = /\b(good|great|excellent|wonderful|pleased|happy|thank|appreciate)\b/i;
    const negative = /\b(bad|terrible|awful|angry|hate|disappointed|refuse|no)\b/i;
    
    if (positive.test(response)) {return 0.1;}
    if (negative.test(response)) {return -0.1;}
    return 0;
  }

  private startPeriodicUpdates(): void {
    this.updateTimer = setInterval(async () => {
      // Update behavior trees for active NPCs
      const activeNPCs = this.config.behaviorSystem.getActiveNPCs();
      for (const npc of activeNPCs) {
        const tree = this.npcBehaviorTrees.get(npc.id);
        if (tree) {
          tree.tick();
        }
      }
    }, this.config.updateInterval);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    this.npcBehaviorTrees.clear();
    this.npcContextHistory.clear();
    this.behaviorCache.clear();
    this.removeAllListeners();
  }
}
