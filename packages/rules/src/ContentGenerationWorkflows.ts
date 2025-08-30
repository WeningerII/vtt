/**
 * Rule-Driven Content Generation Workflows
 * Automatically triggers procedural content generation based on game rules and events
 */

import { DeepRuleEngine, Rule, RuleContext, _RuleEffect, RuleCondition } from './DeepRuleEngine';
import { logger } from '@vtt/logging';
import { ProfessionalContentSuite } from '../content-creation/src/ProfessionalContentSuite';
import { ProceduralBehaviorGenerator } from '../ai/src/ProceduralBehaviorGenerator';
import { globalEventBus, _GameEvents, ContentEvents, _RuleEvents} from '../core/src/EventBus';

export interface ContentGenerationRule extends Rule {
  contentType: 'dungeon' | 'encounter' | 'treasure' | 'npc' | 'quest' | 'behavior' | 'item' | 'spell';
  generationParams: Record<string, any>;
  priority: number;
  cooldown?: number; // Seconds between generations
  maxGenerations?: number; // Max times this rule can trigger
}

export interface GenerationTrigger {
  id: string;
  eventType: string;
  conditions: RuleCondition[];
  contentRules: string[]; // Rule IDs to evaluate
  context: RuleContext;
}

export interface GenerationHistory {
  ruleId: string;
  contentType: string;
  generatedAt: Date;
  parameters: Record<string, any>;
  result: any;
}

export class ContentGenerationWorkflowEngine {
  private ruleEngine: DeepRuleEngine;
  private contentSuite: ProfessionalContentSuite;
  private behaviorGenerator: ProceduralBehaviorGenerator;
  private contentRules: Map<string, ContentGenerationRule> = new Map();
  private generationHistory: GenerationHistory[] = [];
  private activeTriggers: Map<string, GenerationTrigger> = new Map();
  private lastGeneration: Map<string, number> = new Map(); // Rule ID -> timestamp
  private generationCounts: Map<string, number> = new Map(); // Rule ID -> count

  constructor(
    ruleEngine: DeepRuleEngine,
    contentSuite: ProfessionalContentSuite,
    behaviorGenerator: ProceduralBehaviorGenerator
  ) {
    this.ruleEngine = ruleEngine;
    this.contentSuite = contentSuite;
    this.behaviorGenerator = behaviorGenerator;
    
    this.initializeWorkflows();
    this.setupEventListeners();
  }

  /**
   * Register a content generation rule
   */
  registerContentRule(rule: ContentGenerationRule): void {
    this.contentRules.set(rule.id, rule);
    
    // Also register with the main rule engine
    this.ruleEngine.addRule(rule);
  }

  /**
   * Create a generation trigger that listens for specific events
   */
  createGenerationTrigger(trigger: GenerationTrigger): void {
    this.activeTriggers.set(trigger.id, trigger);
  }

  /**
   * Process an event and trigger appropriate content generation
   */
  async processEvent(eventType: string, eventData: any, context: RuleContext): Promise<void> {
    // Find matching triggers
    const matchingTriggers = Array.from(this.activeTriggers.values())
      .filter(trigger => trigger.eventType === eventType);

    for (const trigger of matchingTriggers) {
      // Check trigger conditions
      const conditionsMet = await this.evaluateTriggerConditions(trigger, eventData, context);
      
      if (conditionsMet) {
        // Evaluate associated content rules
        for (const ruleId of trigger.contentRules) {
          await this.evaluateContentRule(ruleId, { ...context, ...trigger.context, eventData });
        }
      }
    }
  }

  /**
   * Evaluate a specific content generation rule
   */
  async evaluateContentRule(ruleId: string, context: RuleContext): Promise<void> {
    const rule = this.contentRules.get(ruleId);
    if (!rule) return;

    // Check cooldown
    if (rule.cooldown) {
      const lastGen = this.lastGeneration.get(ruleId) || 0;
      const now = Date.now();
      if ((now - lastGen) < rule.cooldown * 1000) {
        return; // Still on cooldown
      }
    }

    // Check max generations
    if (rule.maxGenerations) {
      const count = this.generationCounts.get(ruleId) || 0;
      if (count >= rule.maxGenerations) {
        return; // Already hit max generations
      }
    }

    // Evaluate rule conditions
    const conditionsMet = await this.ruleEngine.evaluateConditions(rule.conditions, context);
    
    if (conditionsMet) {
      await this.executeContentGeneration(rule, context);
    }
  }

  /**
   * Execute content generation based on rule
   */
  private async executeContentGeneration(rule: ContentGenerationRule, context: RuleContext): Promise<void> {
    try {
      let result: any = null;
      const params = { ...rule.generationParams, context };

      switch (rule.contentType) {
        case 'dungeon':
          result = await this.generateDungeon(params);
          break;
        case 'encounter':
          result = await this.generateEncounter(params);
          break;
        case 'treasure':
          result = await this.generateTreasure(params);
          break;
        case 'npc':
          result = await this.generateNPC(params);
          break;
        case 'quest':
          result = await this.generateQuest(params);
          break;
        case 'behavior':
          result = await this.generateBehavior(params);
          break;
        case 'item':
          result = await this.generateItem(params);
          break;
        case 'spell':
          result = await this.generateSpell(params);
          break;
      }

      if (result) {
        // Record generation
        this.recordGeneration(rule, params, result);
        
        // Update counters
        this.lastGeneration.set(rule.id, Date.now());
        this.generationCounts.set(rule.id, (this.generationCounts.get(rule.id) || 0) + 1);

        // Emit content generation event
        await globalEventBus.emit(ContentEvents.contentGenerated(rule.contentType, result.id || 'unknown', result));

        // Execute rule effects if any
        if (rule.effects) {
          await this.ruleEngine.executeEffects(rule.effects, { ...context, generatedContent: result });
        }
      }
    } catch (error) {
      logger.error(`Failed to generate ${rule.contentType} for rule ${rule.id}:`, error);
    }
  }

  // Content generation methods
  private async generateDungeon(params: any): Promise<any> {
    const options = {
      width: params.width || 50,
      height: params.height || 50,
      theme: params.theme || 'stone',
      difficulty: params.difficulty || 'moderate',
      roomCount: params.roomCount || { min: 5, max: 15 },
      ...params
    };

    return await this.contentSuite.generateDungeon(options);
  }

  private async generateEncounter(params: any): Promise<any> {
    const partyLevel = params.partyLevel || params.context?.partyLevel || 5;
    const partySize = params.partySize || params.context?.partySize || 4;
    const environment = params.environment || params.context?.currentLocation?.environment || 'dungeon';
    
    const options = {
      partyLevel,
      partySize,
      environment,
      difficulty: params.difficulty || 'balanced',
      theme: params.theme,
      specialConditions: params.specialConditions || [],
      ...params
    };

    return await this.contentSuite.generateEncounter(options);
  }

  private async generateTreasure(params: any): Promise<any> {
    const options = {
      level: params.level || params.context?.partyLevel || 5,
      type: params.type || 'mixed',
      value: params.value,
      magical: params.magical !== false,
      theme: params.theme,
      ...params
    };

    return await this.contentSuite.generateTreasure(options);
  }

  private async generateNPC(params: any): Promise<any> {
    const options = {
      race: params.race,
      class: params.class,
      level: params.level || 1,
      role: params.role || 'citizen',
      personality: params.personality,
      background: params.background,
      location: params.location || params.context?.currentLocation,
      ...params
    };

    return await this.contentSuite.generateNPC(options);
  }

  private async generateQuest(params: any): Promise<any> {
    const options = {
      type: params.type || 'fetch',
      difficulty: params.difficulty || 'moderate',
      location: params.location || params.context?.currentLocation,
      giver: params.giver,
      reward: params.reward,
      timeLimit: params.timeLimit,
      requirements: params.requirements || [],
      ...params
    };

    return await this.contentSuite.generateQuest(options);
  }

  private async generateBehavior(params: any): Promise<any> {
    const options = {
      creatureType: params.creatureType,
      intelligence: params.intelligence || 'average',
      alignment: params.alignment,
      environment: params.environment || params.context?.currentLocation?.environment,
      role: params.role || 'minion',
      complexity: params.complexity || 'moderate',
      ...params
    };

    return await this.behaviorGenerator.generateBehavior(options);
  }

  private async generateItem(params: any): Promise<any> {
    const options = {
      type: params.type || 'weapon',
      rarity: params.rarity || 'common',
      level: params.level || params.context?.partyLevel || 5,
      properties: params.properties || [],
      theme: params.theme,
      ...params
    };

    return await this.contentSuite.generateItem(options);
  }

  private async generateSpell(params: any): Promise<any> {
    const options = {
      level: params.level || 1,
      school: params.school,
      damage: params.damage,
      duration: params.duration,
      range: params.range,
      components: params.components,
      theme: params.theme,
      ...params
    };

    return await this.contentSuite.generateSpell(options);
  }

  /**
   * Evaluate trigger conditions
   */
  private async evaluateTriggerConditions(
    trigger: GenerationTrigger, 
    eventData: any, 
    context: RuleContext
  ): Promise<boolean> {
    for (const condition of trigger.conditions) {
      const result = await this.ruleEngine.evaluateCondition(condition, { ...context, eventData });
      if (!result) return false;
    }
    return true;
  }

  /**
   * Record a generation in history
   */
  private recordGeneration(rule: ContentGenerationRule, params: any, result: any): void {
    this.generationHistory.push({
      ruleId: rule.id,
      contentType: rule.contentType,
      generatedAt: new Date(),
      parameters: params,
      result
    });

    // Keep history limited to prevent memory issues
    if (this.generationHistory.length > 1000) {
      this.generationHistory = this.generationHistory.slice(-500);
    }
  }

  /**
   * Setup event listeners for automatic workflow triggers
   */
  private setupEventListeners(): void {
    // Listen for game events that might trigger content generation
    globalEventBus.on('game:playerEntered', (event) => {
      this.processEvent('playerEntered', event.data, event.context || {});
    });

    globalEventBus.on('game:combatEnded', (event) => {
      this.processEvent('combatEnded', event.data, event.context || {});
    });

    globalEventBus.on('game:questCompleted', (event) => {
      this.processEvent('questCompleted', event.data, event.context || {});
    });

    globalEventBus.on('game:treasureFound', (event) => {
      this.processEvent('treasureFound', event.data, event.context || {});
    });

    globalEventBus.on('rule:conditionMet', (event) => {
      this.processEvent('ruleConditionMet', event.data, event.context || {});
    });
  }

  /**
   * Initialize common workflow rules
   */
  private initializeWorkflows(): void {
    // Auto-generate encounters for empty rooms
    this.registerContentRule({
      id: 'empty_room_encounter',
      name: 'Generate Encounter for Empty Rooms',
      description: 'Automatically populate empty rooms with encounters',
      contentType: 'encounter',
      priority: 5,
      cooldown: 300, // 5 minutes
      conditions: [
        {
          type: 'property',
          property: 'room.isEmpty',
          operator: 'equals',
          value: true
        },
        {
          type: 'property',
          property: 'room.visited',
          operator: 'equals',
          value: false
        },
        {
          type: 'random',
          probability: 0.7
        }
      ],
      effects: [
        {
          type: 'setProperty',
          target: 'room',
          property: 'isEmpty',
          value: false
        }
      ],
      generationParams: {
        difficulty: 'balanced',
        environment: 'dungeon'
      }
    });

    // Generate treasure after combat
    this.registerContentRule({
      id: 'post_combat_treasure',
      name: 'Generate Treasure After Combat',
      description: 'Create treasure rewards after successful combat',
      contentType: 'treasure',
      priority: 7,
      cooldown: 60,
      conditions: [
        {
          type: 'property',
          property: 'combat.result',
          operator: 'equals',
          value: 'victory'
        },
        {
          type: 'property',
          property: 'combat.difficulty',
          operator: 'greaterThan',
          value: 'easy'
        }
      ],
      effects: [
        {
          type: 'addToInventory',
          target: 'currentParty',
          property: 'treasure'
        }
      ],
      generationParams: {
        type: 'combat_reward',
        magical: true
      }
    });

    // Generate random NPCs in towns
    this.registerContentRule({
      id: 'town_npc_generation',
      name: 'Generate Town NPCs',
      description: 'Populate towns with interesting NPCs',
      contentType: 'npc',
      priority: 3,
      cooldown: 1800, // 30 minutes
      maxGenerations: 10,
      conditions: [
        {
          type: 'property',
          property: 'location.type',
          operator: 'equals',
          value: 'town'
        },
        {
          type: 'property',
          property: 'location.npcCount',
          operator: 'lessThan',
          value: 15
        },
        {
          type: 'random',
          probability: 0.3
        }
      ],
      effects: [
        {
          type: 'increment',
          target: 'location',
          property: 'npcCount'
        }
      ],
      generationParams: {
        role: 'citizen',
        personality: 'varied'
      }
    });

    // Generate quests from NPCs
    this.registerContentRule({
      id: 'npc_quest_generation',
      name: 'Generate NPC Quests',
      description: 'Create quests from NPCs when players interact',
      contentType: 'quest',
      priority: 6,
      cooldown: 600, // 10 minutes
      conditions: [
        {
          type: 'property',
          property: 'npc.hasQuest',
          operator: 'equals',
          value: false
        },
        {
          type: 'property',
          property: 'npc.questPotential',
          operator: 'greaterThan',
          value: 0.5
        },
        {
          type: 'property',
          property: 'interaction.type',
          operator: 'equals',
          value: 'conversation'
        }
      ],
      effects: [
        {
          type: 'setProperty',
          target: 'npc',
          property: 'hasQuest',
          value: true
        }
      ],
      generationParams: {
        difficulty: 'moderate',
        type: 'varied'
      }
    });

    // Create corresponding triggers
    this.createGenerationTrigger({
      id: 'room_entry_trigger',
      eventType: 'playerEntered',
      conditions: [
        {
          type: 'property',
          property: 'location.type',
          operator: 'equals',
          value: 'room'
        }
      ],
      contentRules: ['empty_room_encounter'],
      context: Record<string, any>
    });

    this.createGenerationTrigger({
      id: 'combat_end_trigger',
      eventType: 'combatEnded',
      conditions: [],
      contentRules: ['post_combat_treasure'],
      context: Record<string, any>
    });

    this.createGenerationTrigger({
      id: 'town_visit_trigger',
      eventType: 'playerEntered',
      conditions: [
        {
          type: 'property',
          property: 'location.type',
          operator: 'equals',
          value: 'town'
        }
      ],
      contentRules: ['town_npc_generation', 'npc_quest_generation'],
      context: Record<string, any>
    });
  }

  /**
   * Get generation history for analysis
   */
  getGenerationHistory(contentType?: string, limit: number = 50): GenerationHistory[] {
    let history = this.generationHistory;
    
    if (contentType) {
      history = history.filter(h => h.contentType === contentType);
    }
    
    return history
      .sort((_a, _b) => b.generatedAt.getTime() - a.generatedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get statistics about content generation
   */
  getGenerationStats(): Record<string, any> {
    const stats = {
      totalGenerations: this.generationHistory.length,
      byContentType: {} as Record<string, number>,
      byRule: {} as Record<string, number>,
      recentActivity: 0
    };

    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

    this.generationHistory.forEach(gen => {
      // Count by content type
      stats.byContentType[gen.contentType] = (stats.byContentType[gen.contentType] || 0) + 1;
      
      // Count by rule
      stats.byRule[gen.ruleId] = (stats.byRule[gen.ruleId] || 0) + 1;
      
      // Count recent activity
      if (gen.generatedAt.getTime() > oneDayAgo) {
        stats.recentActivity++;
      }
    });

    return stats;
  }
}
