import { logger } from '@vtt/logging';

/**
 * Unified Cross-System Event Bus
 * Enables seamless communication between decision trees, automation, and procedural generation
 */

export interface EventData {
  source: 'rules' | 'ai' | 'content' | 'visual_scripting' | 'game' | 'user' | 'event_bus';
  timestamp: number;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface GameEvent extends EventData {
  type: 'combat_start' | 'combat_end' | 'turn_start' | 'turn_end' | 'character_death' | 
        'spell_cast' | 'damage_dealt' | 'condition_applied' | 'movement' | 'interaction' |
        'rule_triggered' | 'automation_executed' | 'content_generated' | 'script_executed' |
        'session_created' | 'session_ended';
  entityId?: string;
  targetId?: string;
  position?: { x: number; y: number };
  context?: Record<string, any>;
  data: any;
}

export interface ContentEvent extends EventData {
  type: 'asset_created' | 'asset_modified' | 'asset_deleted' | 'generation_requested' |
        'generation_completed' | 'import_completed' | 'export_completed' | 'content_generated';
  assetId?: string;
  assetType?: string;
  context?: Record<string, any>;
  data: any;
}

export interface AIEvent extends EventData {
  type: 'decision_made' | 'behavior_changed' | 'goal_updated' | 'pathfinding_completed' |
        'state_transition' | 'personality_modified' | 'memory_updated';
  entityId: string;
  context?: Record<string, any>;
  data: any;
}

export interface RuleEvent extends EventData {
  type: 'rule_evaluated' | 'effect_applied' | 'workflow_started' | 'workflow_completed' |
        'condition_met' | 'trigger_activated' | 'automation_triggered';
  ruleId?: string;
  workflowId?: string;
  context?: Record<string, any>;
  data: any;
}

export type SystemEvent = GameEvent | ContentEvent | AIEvent | RuleEvent;

export interface EventHandler<T extends SystemEvent = SystemEvent> {
  (event: T): void | Promise<void>;
}

export interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  once: boolean;
  priority: number;
  active: boolean;
}

export class UnifiedEventBus {
  private subscriptions = new Map<string, EventSubscription[]>();
  private eventHistory: SystemEvent[] = [];
  private maxHistorySize = 1000;
  private eventQueue: SystemEvent[] = [];
  private processing = false;
  private stats = {
    eventsProcessed: 0,
    handlersExecuted: 0,
    averageProcessingTime: 0,
    errorCount: 0
  };

  constructor() {
    this.setupPerformanceMonitoring();
  }

  /**
   * Subscribe to events with priority and filtering
   */
  on<T extends SystemEvent>(
    _eventType: string,
    _handler: EventHandler<T>,
    options: {
      priority?: number;
      once?: boolean;
      filter?: (event: T) => boolean;
    } = {}
  ): string {
    const subscription: EventSubscription = {
      id: this.generateId(),
      eventType,
      handler: options.filter ? 
        (event: SystemEvent) => {
          if (options.filter!(event as T)) {
            return handler(event as T);
          }
        } : handler as EventHandler,
      once: options.once || false,
      priority: options.priority || 0,
      active: true
    };

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }

    const handlers = this.subscriptions.get(eventType)!;
    handlers.push(subscription);
    
    // Sort by priority (higher priority first)
    handlers.sort((_a, _b) => b.priority - a.priority);

    return subscription.id;
  }

  /**
   * Subscribe to event once
   */
  once<T extends SystemEvent>(
    _eventType: string,
    _handler: EventHandler<T>,
    options: { priority?: number; filter?: (event: T) => boolean } = {}
  ): string {
    return this.on(eventType, handler, { ...options, once: true });
  }

  /**
   * Unsubscribe from events
   */
  off(subscriptionId: string): boolean {
    for (const [eventType, handlers] of this.subscriptions.entries()) {
      const index = handlers.findIndex(h => h.id === subscriptionId);
      if (index >= 0) {
        handlers.splice(index, 1);
        if (handlers.length === 0) {
          this.subscriptions.delete(eventType);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Emit event to all subscribers
   */
  async emit(event: SystemEvent): Promise<void> {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Add to processing queue
    this.eventQueue.push(event);
    
    if (!this.processing) {
      await this.processQueue();
    }
  }

  /**
   * Process event queue
   */
  private async processQueue(): Promise<void> {
    this.processing = true;
    const startTime = performance.now();

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      await this.processEvent(event);
    }

    this.processing = false;
    
    // Update stats
    const processingTime = performance.now() - startTime;
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime + processingTime) / 2;
  }

  /**
   * Process individual event
   */
  private async processEvent(event: SystemEvent): Promise<void> {
    const handlers = this.subscriptions.get(event.type) || [];
    const globalHandlers = this.subscriptions.get('*') || [];
    const allHandlers = [...handlers, ...globalHandlers].filter(h => h.active);

    this.stats.eventsProcessed++;

    for (const subscription of allHandlers) {
      try {
        const result = subscription.handler(event);
        if (result instanceof Promise) {
          await result;
        }
        
        this.stats.handlersExecuted++;

        // Remove one-time subscriptions
        if (subscription.once) {
          subscription.active = false;
          this.off(subscription.id);
        }
      } catch (error) {
        this.stats.errorCount++;
        logger.error(`Event handler error for ${event.type}:`, error);
        
        // Emit error event
        this.emitSync({
          type: 'handler_error' as any,
          source: 'event_bus',
          timestamp: Date.now(),
          data: { 
            originalEvent: event,
            error: error instanceof Error ? error.message : String(error),
            handlerId: subscription.id
          }
        });
      }
    }
  }

  /**
   * Synchronous emit for internal use
   */
  private emitSync(event: SystemEvent): void {
    // Add to history only
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Get event history with filtering
   */
  getHistory(options: {
    eventType?: string;
    source?: string;
    entityId?: string;
    since?: number;
    limit?: number;
  } = {}): SystemEvent[] {
    let events = this.eventHistory;

    if (options.eventType) {
      events = events.filter(e => e.type === options.eventType);
    }

    if (options.source) {
      events = events.filter(e => e.source === options.source);
    }

    if (options.entityId) {
      events = events.filter(e => 
        ('entityId' in e && e.entityId === options.entityId) ||
        ('assetId' in e && e.assetId === options.entityId)
      );
    }

    if (options.since) {
      events = events.filter(e => e.timestamp >= options.since!);
    }

    if (options.limit) {
      events = events.slice(-options.limit);
    }

    return events;
  }

  /**
   * Create event correlation tracking
   */
  createCorrelation(correlationId: string): EventCorrelation {
    return new EventCorrelation(correlationId, this);
  }

  /**
   * Batch emit multiple events
   */
  async emitBatch(events: SystemEvent[]): Promise<void> {
    for (const event of events) {
      this.eventQueue.push(event);
    }
    
    if (!this.processing) {
      await this.processQueue();
    }
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // Monitor queue size every 5 seconds
    setInterval(() => {
      if (this.eventQueue.length > 100) {
        logger.warn(`Event queue is large: ${this.eventQueue.length} events pending`);
      }
    }, 5000);
  }

  /**
   * Get event bus statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.eventQueue.length,
      historySize: this.eventHistory.length,
      subscriptionCount: Array.from(this.subscriptions.values()).reduce((_sum, _handlers) => sum + handlers.length, 0),
      activeSubscriptions: Array.from(this.subscriptions.values()).reduce((_sum, _handlers) => sum + handlers.filter(h => h.active).length, 0)
    };
  }

  /**
   * Clear all subscriptions and history
   */
  clear(): void {
    this.subscriptions.clear();
    this.eventHistory = [];
    this.eventQueue = [];
    this.processing = false;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

/**
 * Event correlation for tracking related events
 */
export class EventCorrelation {
  private events: SystemEvent[] = [];
  
  constructor(
    public readonly id: string,
    private eventBus: UnifiedEventBus
  ) {}

  /**
   * Emit event with correlation
   */
  async emit(event: Omit<SystemEvent, 'metadata'>): Promise<void> {
    const correlatedEvent = {
      ...event,
      metadata: {
        correlationId: this.id
      }
    } as SystemEvent;
    
    this.events.push(correlatedEvent);
    await this.eventBus.emit(correlatedEvent);
  }

  /**
   * Get all correlated events
   */
  getEvents(): SystemEvent[] {
    return [...this.events];
  }

  /**
   * Wait for specific event in correlation
   */
  async waitFor(eventType: string, timeout: number = 5000): Promise<SystemEvent> {
    return new Promise((_resolve, __reject) => {
      const timeoutId = setTimeout(() => {
        this.eventBus.off(subscriptionId);
        reject(new Error(`Timeout waiting for ${eventType} in correlation ${this.id}`));
      }, timeout);

      const subscriptionId = this.eventBus.on(_eventType, (event) => {
        if (event.metadata?.correlationId === this.id) {
          clearTimeout(timeoutId);
          this.eventBus.off(subscriptionId);
          resolve(event);
        }
      });
    });
  }
}

// Global event bus instance
export const _globalEventBus = new UnifiedEventBus();

// Convenience functions for common event types
export const _GameEvents = {
  combatStart: (entityId: string, data: any): GameEvent => ({
    type: 'combat_start',
    source: 'game',
    timestamp: Date.now(),
    entityId,
    data
  }),

  combatEnd: (data: any): GameEvent => ({
    type: 'combat_end',
    source: 'game',
    timestamp: Date.now(),
    data
  }),

  spellCast: (entityId: string, targetId: string, spellData: any): GameEvent => ({
    type: 'spell_cast',
    source: 'game',
    timestamp: Date.now(),
    entityId,
    targetId,
    data: spellData
  }),

  damageDealt: (entityId: string, targetId: string, damage: number, type?: string): GameEvent => ({
    type: 'damage_dealt',
    source: 'game',
    timestamp: Date.now(),
    entityId,
    targetId,
    data: { damage, type }
  }),

  sessionCreated: (sessionId: string, sessionName: string): GameEvent => ({
    type: 'session_created',
    source: 'game',
    timestamp: Date.now(),
    sessionId,
    data: { sessionName }
  }),

  sessionEnded: (sessionId: string): GameEvent => ({
    type: 'session_ended',
    source: 'game',
    timestamp: Date.now(),
    sessionId,
    data: Record<string, any>
  })
};

export const _AIEvents = {
  decisionMade: (entityId: string, decision: any): AIEvent => ({
    type: 'decision_made',
    source: 'ai',
    timestamp: Date.now(),
    entityId,
    data: decision
  }),

  behaviorChanged: (entityId: string, oldBehavior: string, newBehavior: string): AIEvent => ({
    type: 'behavior_changed',
    source: 'ai',
    timestamp: Date.now(),
    entityId,
    data: { oldBehavior, newBehavior }
  }),

  stateTransition: (entityId: string, fromState: string, toState: string): AIEvent => ({
    type: 'state_transition',
    source: 'ai',
    timestamp: Date.now(),
    entityId,
    data: { fromState, toState }
  })
};

export const _ContentEvents = {
  assetCreated: (assetId: string, assetType: string, data: any): ContentEvent => ({
    type: 'asset_created',
    source: 'content',
    timestamp: Date.now(),
    assetId,
    assetType,
    data
  }),

  generationRequested: (prompt: string, type: string, options?: any): ContentEvent => ({
    type: 'generation_requested',
    source: 'content',
    timestamp: Date.now(),
    data: { prompt, type, options }
  }),

  generationCompleted: (assetId: string, generationData: any): ContentEvent => ({
    type: 'generation_completed',
    source: 'content',
    timestamp: Date.now(),
    assetId,
    data: generationData
  }),

  contentGenerated: (contentType: string, assetId: string, content: any): ContentEvent => ({
    type: 'content_generated',
    source: 'content',
    timestamp: Date.now(),
    assetId,
    data: { contentType, content }
  })
};

export const _RuleEvents = {
  ruleEvaluated: (ruleId: string, result: boolean, context: any): RuleEvent => ({
    type: 'rule_evaluated',
    source: 'rules',
    timestamp: Date.now(),
    ruleId,
    data: { result, context }
  }),

  effectApplied: (ruleId: string, effect: any, target: string): RuleEvent => ({
    type: 'effect_applied',
    source: 'rules',
    timestamp: Date.now(),
    ruleId,
    data: { effect, target }
  }),

  workflowStarted: (workflowId: string, parameters: any): RuleEvent => ({
    type: 'workflow_started',
    source: 'rules',
    timestamp: Date.now(),
    workflowId,
    data: parameters
  })
};
