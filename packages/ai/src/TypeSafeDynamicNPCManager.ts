/**
 * Type-Safe Dynamic NPC Manager
 * Simplified, production-ready implementation with proper TypeScript types
 */

import { EventEmitter } from 'events';
import {
  NPCBehaviorContext,
  GeneratedBehavior,
  InteractionHistory,
  PersonalityEvolution,
  NPCResponse,
  ActionResult,
  CompatibleAIProvider,
  DynamicNPCConfig,
  BehaviorGeneratedEvent,
  DialogueGeneratedEvent,
  PersonalityEvolvedEvent,
  PlayerInteractionEvent
} from './types/AIIntegration';

const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args)
};

export class TypeSafeDynamicNPCManager extends EventEmitter {
  private config: DynamicNPCConfig;
  private behaviorCache = new Map<string, GeneratedBehavior>();
  private dialogueCache = new Map<string, string[]>();
  private npcHistory = new Map<string, string[]>();
  private updateTimer?: NodeJS.Timeout;

  constructor(config: DynamicNPCConfig) {
    super();
    this.config = config;
    this.startPeriodicUpdates();
  }

  /**
   * Generate dynamic behavior for an NPC based on context
   */
  async generateNPCBehavior(npcId: string, context: NPCBehaviorContext): Promise<GeneratedBehavior | null> {
    try {
      const cacheKey = this.generateContextKey(context);
      
      // Check cache first
      if (this.behaviorCache.has(cacheKey)) {
        logger.info(`Using cached behavior for NPC ${npcId}`);
        return this.behaviorCache.get(cacheKey)!;
      }

      if (!this.config.aiProvider.generateText) {
        logger.warn(`AI provider ${this.config.aiProvider.name} does not support text generation`);
        return this.createFallbackBehavior(npcId, context);
      }

      const prompt = this.buildBehaviorPrompt(context);
      const response = await this.config.aiProvider.generateText({
        prompt,
        maxTokens: 800,
        temperature: this.config.creativityLevel,
        model: 'claude-3-sonnet'
      });

      if (!response?.text) {
        logger.warn(`Failed to generate behavior for NPC ${npcId}`);
        return this.createFallbackBehavior(npcId, context);
      }

      const behavior = this.parseBehaviorResponse(response.text, context.npc);
      if (behavior) {
        this.behaviorCache.set(cacheKey, behavior);
        this.emit('behaviorGenerated', {
          type: 'behaviorGenerated',
          timestamp: Date.now(),
          data: { npcId, behavior, context: this.sanitizeContext(context) }
        } as BehaviorGeneratedEvent);
        return behavior;
      }

      return this.createFallbackBehavior(npcId, context);
    } catch (error) {
      logger.error(`Error generating NPC behavior for ${npcId}:`, error);
      return this.createFallbackBehavior(npcId, context);
    }
  }

  /**
   * Generate dynamic dialogue for an NPC
   */
  async generateNPCDialogue(npcId: string, context: NPCBehaviorContext, topic?: string): Promise<string[]> {
    try {
      const cacheKey = `${npcId}_${topic || 'general'}_${context.threatLevel}`;
      
      if (this.dialogueCache.has(cacheKey)) {
        logger.info(`Using cached dialogue for NPC ${npcId}`);
        return this.dialogueCache.get(cacheKey)!;
      }

      if (!this.config.aiProvider.generateText) {
        logger.warn(`AI provider ${this.config.aiProvider.name} does not support text generation`);
        return this.createFallbackDialogue(npcId, context);
      }

      const prompt = this.buildDialoguePrompt(context, topic);
      const response = await this.config.aiProvider.generateText({
        prompt,
        maxTokens: 400,
        temperature: Math.min(1.0, this.config.creativityLevel + 0.2),
        model: 'claude-3-sonnet'
      });

      if (!response?.text) {
        return this.createFallbackDialogue(npcId, context);
      }

      const dialogue = this.parseDialogueResponse(response.text);
      this.dialogueCache.set(cacheKey, dialogue);
      
      this.emit('dialogueGenerated', {
        type: 'dialogueGenerated',
        timestamp: Date.now(),
        data: { npcId, dialogue, topic }
      } as DialogueGeneratedEvent);

      return dialogue;
    } catch (error) {
      logger.error(`Error generating dialogue for NPC ${npcId}:`, error);
      return this.createFallbackDialogue(npcId, context);
    }
  }

  /**
   * Process player interaction with NPC
   */
  async generateContextualResponse(
    npcId: string, 
    playerId: string,
    playerAction: string, 
    gameState: Record<string, any> = {}
  ): Promise<NPCResponse | null> {
    try {
      const npc = this.config.behaviorSystem.getNPC(npcId);
      if (!npc) {
        logger.warn(`NPC ${npcId} not found for contextual response`);
        return null;
      }

      if (!this.config.aiProvider.generateText) {
        logger.warn(`AI provider ${this.config.aiProvider.name} does not support text generation`);
        return this.createFallbackResponse(npcId, playerAction);
      }

      const campaignContext = this.config.campaignAssistant.context || {};
      const prompt = this.buildContextualResponsePrompt(npc, playerAction, gameState, campaignContext);
      
      const response = await this.config.aiProvider.generateText({
        prompt,
        maxTokens: 500,
        temperature: this.config.creativityLevel,
        model: 'claude-3-sonnet'
      });

      if (!response?.text) {
        return this.createFallbackResponse(npcId, playerAction);
      }

      const parsed = this.parseInteractionResponse(response.text);
      
      // Update NPC's memory
      this.addToNPCHistory(npcId, `Player ${playerId}: ${playerAction}`);
      this.addToNPCHistory(npcId, `${npc.name}: ${parsed.response}`);
      
      this.emit('playerInteraction', {
        type: 'playerInteraction',
        timestamp: Date.now(),
        data: { npcId, playerId, interaction: playerAction, response: parsed.response }
      } as PlayerInteractionEvent);

      return parsed;
    } catch (error) {
      logger.error(`Error generating contextual response for NPC ${npcId}:`, error);
      return this.createFallbackResponse(npcId, playerAction);
    }
  }

  /**
   * Get NPC interaction history
   */
  getNPCHistory(npcId: string): string[] {
    return this.npcHistory.get(npcId) || [];
  }

  /**
   * Clear caches and history for an NPC
   */
  clearNPCData(npcId: string): void {
    this.npcHistory.delete(npcId);
    // Clear related cache entries
    for (const [key, _] of this.behaviorCache) {
      if (key.includes(npcId)) {
        this.behaviorCache.delete(key);
      }
    }
    for (const [key, _] of this.dialogueCache) {
      if (key.startsWith(npcId)) {
        this.dialogueCache.delete(key);
      }
    }
  }

  /**
   * Get system metrics
   */
  getMetrics(): Record<string, any> {
    return {
      behaviorCacheSize: this.behaviorCache.size,
      dialogueCacheSize: this.dialogueCache.size,
      trackedNPCs: this.npcHistory.size,
      totalHistoryEntries: Array.from(this.npcHistory.values()).reduce((sum, history) => sum + history.length, 0)
    };
  }

  // Private helper methods
  private generateContextKey(context: NPCBehaviorContext): string {
    return `${context.npc.id}_${context.location}_${context.threatLevel}_${context.currentGoal}`;
  }

  private buildBehaviorPrompt(context: NPCBehaviorContext): string {
    const npc = context.npc;
    return `Generate behavior for NPC "${npc.name}" in the following context:
Location: ${context.location}
Current Goal: ${context.currentGoal}
Threat Level: ${context.threatLevel}
Nearby Entities: ${context.nearbyEntities.join(', ')}
${npc.personality ? `Personality Traits: ${npc.personality.traits.join(', ')}` : ''}

Return a JSON object with:
- action: specific action name
- description: detailed description of what the NPC does
- priority: number between 0 and 1 indicating urgency
- duration: estimated duration in seconds (optional)

Example: {"action": "patrol", "description": "The guard walks a steady patrol route", "priority": 0.7, "duration": 30}`;
  }

  private buildDialoguePrompt(context: NPCBehaviorContext, topic?: string): string {
    const npc = context.npc;
    return `Generate dialogue for NPC "${npc.name}" in the following context:
Location: ${context.location}
Threat Level: ${context.threatLevel}
${topic ? `Topic: ${topic}` : ''}
${npc.personality ? `Personality: ${npc.personality.traits.join(', ')}` : ''}

Generate 1-3 dialogue options as a JSON array of strings.
Example: ["Hello there, traveler!", "What brings you to these parts?", "Be careful around here."]`;
  }

  private buildContextualResponsePrompt(
    npc: any, 
    playerAction: string, 
    gameState: Record<string, any>, 
    campaignContext: Record<string, any>
  ): string {
    return `NPC "${npc.name}" responds to player action: "${playerAction}"

Context:
- Game State: ${JSON.stringify(gameState)}
- Campaign Context: ${JSON.stringify(campaignContext)}
${npc.personality ? `- NPC Personality: ${JSON.stringify(npc.personality)}` : ''}

Generate a response as JSON:
{
  "response": "What the NPC says or does",
  "actions": [{"type": "action_type", "description": "what happens", "success": true}]
}`;
  }

  private parseBehaviorResponse(text: string, npc: any): GeneratedBehavior | null {
    try {
      const parsed = JSON.parse(text);
      return {
        action: parsed.action || 'idle',
        description: parsed.description || `${npc.name} stands quietly.`,
        priority: Math.max(0, Math.min(1, parsed.priority || 0.5)),
        duration: parsed.duration,
        conditions: parsed.conditions
      };
    } catch {
      // Fallback parsing from text
      return {
        action: 'observe',
        description: text.slice(0, 200),
        priority: 0.5
      };
    }
  }

  private parseDialogueResponse(text: string): string[] {
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [text];
    } catch {
      // Split by common delimiters
      return text.split(/[.!?]\s+/).filter(line => line.trim().length > 0).slice(0, 3);
    }
  }

  private parseInteractionResponse(text: string): NPCResponse {
    try {
      const parsed = JSON.parse(text);
      return {
        response: parsed.response || text,
        actions: parsed.actions || [],
        analysis: parsed.analysis
      };
    } catch {
      return {
        response: text,
        actions: []
      };
    }
  }

  private createFallbackBehavior(npcId: string, context: NPCBehaviorContext): GeneratedBehavior {
    const actions = ['idle', 'observe', 'patrol', 'rest'];
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    return {
      action,
      description: `${context.npc.name} ${action}s quietly in the ${context.location}.`,
      priority: 0.3
    };
  }

  private createFallbackDialogue(npcId: string, context: NPCBehaviorContext): string[] {
    const responses = [
      `${context.npc.name} nods silently.`,
      `${context.npc.name} looks around cautiously.`,
      `${context.npc.name} seems deep in thought.`
    ];
    return [responses[Math.floor(Math.random() * responses.length)]];
  }

  private createFallbackResponse(npcId: string, playerAction: string): NPCResponse {
    return {
      response: `The NPC acknowledges your action: ${playerAction}`,
      actions: [{ type: 'acknowledge', description: 'NPC nods', success: true }]
    };
  }

  private sanitizeContext(context: NPCBehaviorContext): Record<string, any> {
    return {
      npcId: context.npc.id,
      location: context.location,
      threatLevel: context.threatLevel,
      currentGoal: context.currentGoal
    };
  }

  private addToNPCHistory(npcId: string, entry: string): void {
    if (!this.npcHistory.has(npcId)) {
      this.npcHistory.set(npcId, []);
    }
    const history = this.npcHistory.get(npcId)!;
    history.push(entry);
    
    // Keep only last 50 entries
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  private startPeriodicUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    
    this.updateTimer = setInterval(() => {
      this.cleanupCaches();
    }, this.config.updateInterval);
  }

  private cleanupCaches(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    // Simple cache cleanup - in production, use more sophisticated TTL
    if (this.behaviorCache.size > 1000) {
      this.behaviorCache.clear();
    }
    if (this.dialogueCache.size > 1000) {
      this.dialogueCache.clear();
    }
  }

  dispose(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    this.behaviorCache.clear();
    this.dialogueCache.clear();
    this.npcHistory.clear();
    this.removeAllListeners();
  }
}
