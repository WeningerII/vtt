/**
 * System Integration Hub
 * Central orchestrator that connects all VTT systems together
 */

import { EventEmitter } from 'events';
import { _globalEventBus as globalEventBus, _GameEvents as GameEvents, _AIEvents as AIEvents, _ContentEvents as ContentEvents, _RuleEvents as RuleEvents } from './EventBus';

export interface SystemIntegrationConfig {
  enableRuleEngine?: boolean;
  enableVisualScripting?: boolean;
  enableContentGeneration?: boolean;
  enableBehaviorGeneration?: boolean;
  enableWorkflowEngine?: boolean;
  ruleEnginePath?: string;
  contentSuitePath?: string;
  behaviorSeed?: number;
}

export interface SystemStatus {
  ruleEngine: 'active' | 'inactive' | 'error';
  visualScripting: 'active' | 'inactive' | 'error';
  contentSuite: 'active' | 'inactive' | 'error';
  behaviorGenerator: 'active' | 'inactive' | 'error';
  workflowEngine: 'active' | 'inactive' | 'error';
  lastHealthCheck: Date;
  errors: string[];
}

/**
 * Central system integration and orchestration class
 */
export class SystemIntegration extends EventEmitter {
  private config: SystemIntegrationConfig;
  private isInitialized = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: SystemIntegrationConfig = {}) {
    super();
    this.config = {
      enableRuleEngine: true,
      enableVisualScripting: true,
      enableContentGeneration: true,
      enableBehaviorGeneration: true,
      enableWorkflowEngine: true,
      behaviorSeed: Date.now(),
      ...config
    };
  }

  /**
   * Initialize all core systems
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('SystemIntegration already initialized');
    }

    try {
      console.log('🔧 Initializing VTT System Integration...');

      // Register event handlers for system coordination
      this.registerEventHandlers();

      // Start health monitoring
      this.startHealthMonitoring();

      this.isInitialized = true;
      console.log('✅ VTT System Integration initialized successfully');
      this.emit('systemReady');

    } catch (error) {
      console.error('❌ Failed to initialize VTT System Integration:', error);
      this.emit('systemError', error);
      throw error;
    }
  }

  /**
   * Register global event handlers for system coordination
   */
  private registerEventHandlers(): void {
    // Handle game events
    globalEventBus.on('game:playerEntered', (event) => {
      this.handleGameEvent('playerEntered', event);
    });

    globalEventBus.on('game:combatStarted', (event) => {
      this.handleGameEvent('combatStarted', event);
    });

    globalEventBus.on('game:questCompleted', (event) => {
      this.handleGameEvent('questCompleted', event);
    });

    // Handle AI events
    globalEventBus.on('ai:behaviorChanged', (event) => {
      this.handleAIEvent('behaviorChanged', event);
    });

    // Handle content events
    globalEventBus.on('content:generated', (event) => {
      this.handleContentEvent('contentGenerated', event);
    });

    // Handle rule events
    globalEventBus.on('rule:triggered', (event) => {
      this.handleRuleEvent('ruleTriggered', event);
    });
  }

  /**
   * Handle game events across all systems
   */
  private async handleGameEvent(eventType: string, event: any): Promise<void> {
    const context = { ...event.context, eventType, timestamp: new Date() };
    console.log(`🎮 Processing game event: ${eventType}`);
    // Systems will be dynamically loaded when needed
  }

  /**
   * Handle AI events
   */
  private async handleAIEvent(eventType: string, event: any): Promise<void> {
    console.log(`🤖 Processing AI event: ${eventType}`);
    // AI systems coordination will be implemented
  }

  /**
   * Handle content events
   */
  private async handleContentEvent(eventType: string, event: any): Promise<void> {
    console.log(`📝 Processing content event: ${eventType}`);
    // Content systems coordination will be implemented
  }

  /**
   * Handle rule events
   */
  private async handleRuleEvent(eventType: string, event: any): Promise<void> {
    console.log(`⚖️ Processing rule event: ${eventType}`);
    // Rule systems coordination will be implemented
  }

  /**
   * Start health monitoring for all systems
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const status = await this.getSystemStatus();
        this.emit('healthCheck', status);
        
        // Log any errors
        if (status.errors.length > 0) {
          console.warn('System health issues detected:', status.errors);
        }
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get current system status
   */
  async getSystemStatus(): Promise<SystemStatus> {
    const status: SystemStatus = {
      ruleEngine: this.config.enableRuleEngine ? 'active' : 'inactive',
      visualScripting: this.config.enableVisualScripting ? 'active' : 'inactive',
      contentSuite: this.config.enableContentGeneration ? 'active' : 'inactive',
      behaviorGenerator: this.config.enableBehaviorGeneration ? 'active' : 'inactive',
      workflowEngine: this.config.enableWorkflowEngine ? 'active' : 'inactive',
      lastHealthCheck: new Date(),
      errors: []
    };

    return status;
  }

  /**
   * Shutdown all systems gracefully
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down VTT System Integration...');

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.isInitialized = false;
    console.log('✅ VTT System Integration shutdown complete');
    this.emit('systemShutdown');
  }

  /**
   * Check if system is fully initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

export interface SystemConfiguration {
  enableAI: boolean;
  enableContentGeneration: boolean;
  enableVisualScripting: boolean;
  enableRules: boolean;
  enableProcedural: boolean;
}

export interface IntegratedGameSession {
  id: string;
  name: string;
  systems: {
    ruleEngine: DeepRuleEngine;
    visualScripting: VisualScriptingEngine;
    contentSuite: ProfessionalContentSuite;
    behaviorGenerator: ProceduralBehaviorGenerator;
    workflowEngine: ContentGenerationWorkflowEngine;
  };
  configuration: SystemConfiguration;
  activeEntities: Map<string, any>;
  sessionData: Record<string, any>;
}

export interface SystemIntegrationConfig {
  enableRuleEngine?: boolean;
  enableVisualScripting?: boolean;
  enableContentGeneration?: boolean;
  enableBehaviorGeneration?: boolean;
  enableWorkflowEngine?: boolean;
  ruleEnginePath?: string;
  contentSuitePath?: string;
  behaviorSeed?: number;
}

export interface SystemStatus {
  ruleEngine: 'active' | 'inactive' | 'error';
  visualScripting: 'active' | 'inactive' | 'error';
  contentSuite: 'active' | 'inactive' | 'error';
  behaviorGenerator: 'active' | 'inactive' | 'error';
  workflowEngine: 'active' | 'inactive' | 'error';
  lastHealthCheck: Date;
  errors: string[];
}

/**
 * Central system integration and orchestration class
 */
export class VTTSystemIntegrator extends EventEmitter {
  private sessions: Map<string, IntegratedGameSession> = new Map();
  private defaultConfiguration: SystemConfiguration = {
    enableAI: true,
    enableContentGeneration: true,
    enableVisualScripting: true,
    enableRules: true,
    enableProcedural: true
  };

  private config: SystemIntegrationConfig;
  private ruleEngine?: DeepRuleEngine;
  private visualScriptingEngine?: VisualScriptingEngine;
  private contentSuite?: ProfessionalContentSuite;
  private behaviorGenerator?: ProceduralBehaviorGenerator;
  private workflowEngine?: ContentGenerationWorkflowEngine;
  private isInitialized = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: SystemIntegrationConfig = {}) {
    super();
    this.config = {
      enableRuleEngine: true,
      enableVisualScripting: true,
      enableContentGeneration: true,
      enableBehaviorGeneration: true,
      enableWorkflowEngine: true,
      behaviorSeed: Date.now(),
      ...config
    };
  }

  /**
   * Create a new integrated game session
   */
  async createSession(
    sessionId: string, 
    sessionName: string, 
    config: Partial<SystemConfiguration> = {}
  ): Promise<IntegratedGameSession> {
    const configuration = { ...this.defaultConfiguration, ...config };
    
    // Initialize core systems
    const ruleEngine = new DeepRuleEngine();
    const visualScripting = new VisualScriptingEngine();
    const contentSuite = new ProfessionalContentSuite();
    const behaviorGenerator = new ProceduralBehaviorGenerator();
    const workflowEngine = new ContentGenerationWorkflowEngine(
      ruleEngine, 
      contentSuite, 
      behaviorGenerator
    );

    // Configure visual scripting with game nodes
    allGameNodes.forEach(node => {
      visualScripting.registerNode(node);
    });

    // Setup system integrations
    await this.setupSystemIntegrations(
      ruleEngine,
      visualScripting,
      contentSuite,
      behaviorGenerator,
      workflowEngine,
      configuration
    );

    const session: IntegratedGameSession = {
      id: sessionId,
      name: sessionName,
      systems: {
        ruleEngine,
        visualScripting,
        contentSuite,
        behaviorGenerator,
        workflowEngine
      },
      configuration,
      activeEntities: new Map(),
      sessionData: {}
    };

    this.sessions.set(sessionId, session);

    // Emit session creation event
    await globalEventBus.emit(GameEvents.sessionCreated(sessionId, sessionName));

    return session;
  }

  /**
   * Setup integrations between all systems
   */
  private async setupSystemIntegrations(
    ruleEngine: DeepRuleEngine,
    visualScripting: VisualScriptingEngine,
    contentSuite: ProfessionalContentSuite,
    behaviorGenerator: ProceduralBehaviorGenerator,
    workflowEngine: ContentGenerationWorkflowEngine,
    config: SystemConfiguration
  ): Promise<void> {
    // Rule Engine Integrations
    if (config.enableRules) {
      // Connect rule engine to visual scripting
      this.setupRuleVisualScriptingIntegration(ruleEngine, visualScripting);
      
      // Connect rule engine to AI behaviors
      this.setupRuleAIIntegration(ruleEngine, behaviorGenerator);
      
      // Connect rule engine to content generation
      this.setupRuleContentIntegration(ruleEngine, contentSuite);
    }

    // AI System Integrations
    if (config.enableAI) {
      // Connect AI to visual scripting for behavior scripting
      this.setupAIVisualScriptingIntegration(behaviorGenerator, visualScripting);
      
      // Connect AI to content generation for procedural behaviors
      this.setupAIContentIntegration(behaviorGenerator, contentSuite);
    }

    // Content Generation Integrations
    if (config.enableContentGeneration) {
      // Connect content generation to visual scripting
      this.setupContentVisualScriptingIntegration(contentSuite, visualScripting);
      
      // Connect content generation to rule workflows
      this.setupContentRuleIntegration(contentSuite, workflowEngine);
    }

    // Global Event Bus Integrations
    this.setupEventBusIntegrations(ruleEngine, visualScripting, contentSuite, behaviorGenerator);
  }

  /**
   * Setup Rule Engine <-> Visual Scripting integration
   */
  private setupRuleVisualScriptingIntegration(
    ruleEngine: DeepRuleEngine, 
    visualScripting: VisualScriptingEngine
  ): void {
    // Rules can trigger visual scripts
    ruleEngine.registerEffect('executeScript', async (effect: any, context: any) => {
      const scriptId = effect.parameters?.scriptId;
      const scriptInputs = effect.parameters?.inputs || {};
      
      if (scriptId) {
        await visualScripting.executeScript(scriptId, scriptInputs);
      }
    });

    // Visual scripts can trigger rule evaluation
    visualScripting.registerNode({
      type: 'rule_evaluate',
      name: 'Evaluate Rule',
      category: 'rules',
      description: 'Evaluate a rule and get the result',
      inputs: [
        { id: 'exec', name: 'Execute', type: 'exec', required: true },
        { id: 'rule_id', name: 'Rule ID', type: 'string', required: true },
        { id: 'context', name: 'Context', type: 'object', required: false }
      ],
      outputs: [
        { id: 'exec', name: 'Execute', type: 'exec' },
        { id: 'result', name: 'Rule Result', type: 'boolean' },
        { id: 'effects', name: 'Rule Effects', type: 'array' }
      ],
      properties: [],
      executor: async (inputs) => {
        const ruleId = inputs.rule_id;
        const context = inputs.context || {};
        
        const result = await ruleEngine.evaluateRule(ruleId, context);
        
        return {
          exec: true,
          result: result.passed,
          effects: result.effects
        };
      }
    });
  }

  /**
   * Setup Rule Engine <-> AI integration
   */
  private setupRuleAIIntegration(
    ruleEngine: DeepRuleEngine, 
    behaviorGenerator: ProceduralBehaviorGenerator
  ): void {
    // Rules can generate AI behaviors
    ruleEngine.registerEffect('generateBehavior', async (effect, context) => {
      const behaviorOptions = effect.parameters || {};
      const entityId = effect.target || context.entityId;
      
      const behavior = await behaviorGenerator.generateBehavior(behaviorOptions);
      
      // Store behavior for entity
      if (entityId && context.session) {
        const session = this.sessions.get(context.session);
        if (session) {
          session.activeEntities.set(entityId + '_behavior', behavior);
        }
      }
      
      await globalEventBus.emit(AIEvents.behaviorChanged(entityId, 'none', 'generated'));
    });

    // AI behavior changes can trigger rules
    globalEventBus.on('ai:behaviorChanged', async (event) => {
      await ruleEngine.processEvent('ai_behavior_changed', event.data, event.context || {});
    });
  }

  /**
   * Setup Rule Engine <-> Content Generation integration
   */
  private setupRuleContentIntegration(
    ruleEngine: DeepRuleEngine, 
    contentSuite: ProfessionalContentSuite
  ): void {
    // Rules can trigger content generation
    const contentTypes = ['dungeon', 'encounter', 'treasure', 'npc', 'quest', 'item', 'spell'];
    
    contentTypes.forEach(contentType => {
      ruleEngine.registerEffect(`generate${contentType.charAt(0).toUpperCase() + contentType.slice(1)}`, 
        async (effect, context) => {
          const options = effect.parameters || {};
          let result = null;
          
          switch (contentType) {
            case 'dungeon':
              result = await contentSuite.generateDungeon(options);
              break;
            case 'encounter':
              result = await contentSuite.generateEncounter(options);
              break;
            case 'treasure':
              result = await contentSuite.generateTreasure(options);
              break;
            case 'npc':
              result = await contentSuite.generateNPC(options);
              break;
            case 'quest':
              result = await contentSuite.generateQuest(options);
              break;
            case 'item':
              result = await contentSuite.generateItem(options);
              break;
            case 'spell':
              result = await contentSuite.generateSpell(options);
              break;
          }
          
          if (result) {
            await globalEventBus.emit(ContentEvents.contentGenerated(contentType, result.id, result));
          }
        }
      );
    });
  }

  /**
   * Setup AI <-> Visual Scripting integration
   */
  private setupAIVisualScriptingIntegration(
    behaviorGenerator: ProceduralBehaviorGenerator,
    visualScripting: VisualScriptingEngine
  ): void {
    // Visual scripts can generate AI behaviors
    visualScripting.registerNode({
      type: 'ai_generate_behavior',
      name: 'Generate AI Behavior',
      category: 'ai',
      description: 'Generate procedural AI behavior for an entity',
      inputs: [
        { id: 'exec', name: 'Execute', type: 'exec', required: true },
        { id: 'entity', name: 'Entity', type: 'character', required: true },
        { id: 'options', name: 'Generation Options', type: 'object', required: false }
      ],
      outputs: [
        { id: 'exec', name: 'Execute', type: 'exec' },
        { id: 'behavior', name: 'Generated Behavior', type: 'object' },
        { id: 'success', name: 'Success', type: 'boolean' }
      ],
      properties: [],
      executor: async (inputs) => {
        const entity = inputs.entity;
        const options = inputs.options || {};
        
        try {
          const behavior = await behaviorGenerator.generateBehavior({
            ...options,
            creatureType: entity.type,
            intelligence: entity.intelligence,
            alignment: entity.alignment
          });
          
          return {
            exec: true,
            behavior,
            success: true
          };
        } catch (error) {
          return {
            exec: true,
            behavior: null,
            success: false
          };
        }
      }
    });
  }

  /**
   * Setup AI <-> Content Generation integration
   */
  private setupAIContentIntegration(
    behaviorGenerator: ProceduralBehaviorGenerator,
    contentSuite: ProfessionalContentSuite
  ): void {
    // Content generation can automatically create appropriate AI behaviors
    globalEventBus.on('content:contentGenerated', async (event) => {
      if (event.data.contentType === 'npc' || event.data.contentType === 'encounter') {
        const content = event.data.content;
        
        // Generate behaviors for NPCs or creatures in encounters
        if (content.creatures || content.type === 'npc') {
          const entities = content.creatures || [content];
          
          for (const entity of entities) {
            if (entity.needsAI) {
              const behavior = await behaviorGenerator.generateBehavior({
                creatureType: entity.type,
                intelligence: entity.intelligence,
                alignment: entity.alignment,
                role: entity.role
              });
              
              entity.behavior = behavior;
            }
          }
        }
      }
    });
  }

  /**
   * Setup Content Generation <-> Visual Scripting integration
   */
  private setupContentVisualScriptingIntegration(
    contentSuite: ProfessionalContentSuite,
    visualScripting: VisualScriptingEngine
  ): void {
    // Visual scripts can trigger content generation
    const contentGenerationNodes = [
      { type: 'generate_dungeon', method: 'generateDungeon' },
      { type: 'generate_encounter', method: 'generateEncounter' },
      { type: 'generate_treasure', method: 'generateTreasure' },
      { type: 'generate_npc', method: 'generateNPC' },
      { type: 'generate_quest', method: 'generateQuest' },
      { type: 'generate_item', method: 'generateItem' },
      { type: 'generate_spell', method: 'generateSpell' }
    ];

    contentGenerationNodes.forEach(({ type, method }) => {
      visualScripting.registerNode({
        type,
        name: `Generate ${type.split('_')[1]}`.replace(/\b\w/g, l => l.toUpperCase()),
        category: 'content',
        description: `Generate ${type.split('_')[1]} content procedurally`,
        inputs: [
          { id: 'exec', name: 'Execute', type: 'exec', required: true },
          { id: 'options', name: 'Generation Options', type: 'object', required: false }
        ],
        outputs: [
          { id: 'exec', name: 'Execute', type: 'exec' },
          { id: 'result', name: 'Generated Content', type: 'object' },
          { id: 'success', name: 'Success', type: 'boolean' }
        ],
        properties: [],
        executor: async (inputs) => {
          const options = inputs.options || {};
          
          try {
            const result = await (contentSuite as any)[method](options);
            return {
              exec: true,
              result,
              success: true
            };
          } catch (error) {
            return {
              exec: true,
              result: null,
              success: false
            };
          }
        }
      });
    });
  }

  /**
   * Setup Content Generation <-> Rule Workflows integration
   */
  private setupContentRuleIntegration(
    contentSuite: ProfessionalContentSuite,
    workflowEngine: ContentGenerationWorkflowEngine
  ): void {
    // Content generation events trigger workflow evaluation
    globalEventBus.on('content:contentGenerated', async (event) => {
      await workflowEngine.processEvent('contentGenerated', event.data, event.context || {});
    });

    // Game events trigger content generation workflows
    globalEventBus.on('game:*', async (event) => {
      const eventType = event.type.split(':')[1];
      await workflowEngine.processEvent(eventType, event.data, event.context || {});
    });
  }

  /**
   * Setup global event bus integrations
   */
  private setupEventBusIntegrations(
    ruleEngine: DeepRuleEngine,
    visualScripting: VisualScriptingEngine,
    contentSuite: ProfessionalContentSuite,
    behaviorGenerator: ProceduralBehaviorGenerator
  ): void {
    // Rule events
    globalEventBus.on('rule:*', async (event) => {
      const eventType = event.type.split(':')[1];
      await ruleEngine.processEvent(eventType, event.data, event.context || {});
    });

    // AI events
    globalEventBus.on('ai:*', async (event) => {
      // Can be used to trigger rule evaluations or content generation
      const eventType = event.type.split(':')[1];
      await ruleEngine.processEvent(`ai_${eventType}`, event.data, event.context || {});
    });

    // Content events
    globalEventBus.on('content:*', async (event) => {
      // Can trigger rule evaluations
      const eventType = event.type.split(':')[1];
      await ruleEngine.processEvent(`content_${eventType}`, event.data, event.context || {});
    });

    // Game events trigger all systems
    globalEventBus.on('game:*', async (event) => {
      const eventType = event.type.split(':')[1];
      
      // All systems can respond to game events
      await ruleEngine.processEvent(eventType, event.data, event.context || {});
      
      // Visual scripts can have event-driven execution
      const scripts = visualScripting.getScriptsByTrigger(eventType);
      for (const script of scripts) {
        await visualScripting.executeScript(script.id, { eventData: event.data });
      }
    });
  }

  /**
   * Get a game session
   */
  getSession(sessionId: string): IntegratedGameSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): IntegratedGameSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Close a game session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Cleanup session resources
      session.activeEntities.clear();
      session.sessionData = {};
      
      this.sessions.delete(sessionId);
      
      await globalEventBus.emit(GameEvents.sessionEnded(sessionId));
    }
  }

  /**
   * Execute a cross-system operation
   */
  async executeCrossSystemOperation(
    sessionId: string,
    operation: string,
    parameters: Record<string, any>
  ): Promise<any> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const { systems } = session;

    switch (operation) {
      case 'generateDungeonWithEncounters':
        // Generate dungeon with automatic encounter population
        const dungeon = await systems.contentSuite.generateDungeon(parameters.dungeonOptions);
        
        // Generate encounters for each room
        for (const room of dungeon.rooms) {
          if (Math.random() < 0.7) { // 70% chance for encounter
            const encounter = await systems.contentSuite.generateEncounter({
              ...parameters.encounterOptions,
              environment: dungeon.theme,
              roomSize: room.size
            });
            room.encounter = encounter;
          }
        }
        
        return dungeon;

      case 'createSmartNPC':
        // Generate NPC with AI behavior and potential quests
        const npc = await systems.contentSuite.generateNPC(parameters.npcOptions);
        
        // Generate AI behavior
        const behavior = await systems.behaviorGenerator.generateBehavior({
          creatureType: npc.race,
          intelligence: npc.intelligence,
          alignment: npc.alignment,
          role: npc.role
        });
        npc.behavior = behavior;
        
        // Maybe generate a quest
        if (Math.random() < 0.3) { // 30% chance for quest
          const quest = await systems.contentSuite.generateQuest({
            ...parameters.questOptions,
            giver: npc.id,
            location: npc.location
          });
          npc.quest = quest;
        }
        
        return npc;

      case 'triggerEventChain':
        // Trigger a complex event chain across all systems
        const eventData = parameters.eventData;
        
        // Start with rule evaluation
        await systems.ruleEngine.processEvent(parameters.eventType, eventData, parameters.context);
        
        // Trigger visual script if specified
        if (parameters.scriptId) {
          await systems.visualScripting.executeScript(parameters.scriptId, eventData);
        }
        
        // Let content generation workflows respond
        await systems.workflowEngine.processEvent(parameters.eventType, eventData, parameters.context);
        
        return { success: true, message: 'Event chain triggered successfully' };

      default:
        throw new Error(`Unknown cross-system operation: ${operation}`);
    }
  }
}

// Global integrator instance
export const vttIntegrator = new VTTSystemIntegrator();
