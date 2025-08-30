/**
 * Unified Cross-System Event Bus
 * Enables seamless communication between decision trees, automation, and procedural generation
 */
export interface EventData {
  source: "rules" | "ai" | "content" | "visual_scripting" | "game" | "user" | "event_bus";
  timestamp: number;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}
export interface GameEvent extends EventData {
  type:
    | "combat_start"
    | "combat_end"
    | "turn_start"
    | "turn_end"
    | "character_death"
    | "spell_cast"
    | "damage_dealt"
    | "condition_applied"
    | "movement"
    | "interaction"
    | "rule_triggered"
    | "automation_executed"
    | "content_generated"
    | "script_executed"
    | "session_created"
    | "session_ended";
  entityId?: string;
  targetId?: string;
  position?: {
    x: number;
    y: number;
  };
  context?: Record<string, any>;
  data: any;
}
export interface ContentEvent extends EventData {
  type:
    | "asset_created"
    | "asset_modified"
    | "asset_deleted"
    | "generation_requested"
    | "generation_completed"
    | "import_completed"
    | "export_completed"
    | "content_generated";
  assetId?: string;
  assetType?: string;
  context?: Record<string, any>;
  data: any;
}
export interface AIEvent extends EventData {
  type:
    | "decision_made"
    | "behavior_changed"
    | "goal_updated"
    | "pathfinding_completed"
    | "state_transition"
    | "personality_modified"
    | "memory_updated";
  entityId: string;
  context?: Record<string, any>;
  data: any;
}
export interface RuleEvent extends EventData {
  type:
    | "rule_evaluated"
    | "effect_applied"
    | "workflow_started"
    | "workflow_completed"
    | "condition_met"
    | "trigger_activated"
    | "automation_triggered";
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
export declare class UnifiedEventBus {
  private subscriptions;
  private eventHistory;
  private maxHistorySize;
  private eventQueue;
  private processing;
  private stats;
  constructor();
  /**
   * Subscribe to events with priority and filtering
   */
  on<T extends SystemEvent>(
    _eventType: string,
    _handler: EventHandler<T>,
    options?: {
      priority?: number;
      once?: boolean;
      filter?: (event: T) => boolean;
    },
  ): string;
  /**
   * Subscribe to event once
   */
  once<T extends SystemEvent>(
    _eventType: string,
    _handler: EventHandler<T>,
    options?: {
      priority?: number;
      filter?: (event: T) => boolean;
    },
  ): string;
  /**
   * Unsubscribe from events
   */
  off(subscriptionId: string): boolean;
  /**
   * Emit event to all subscribers
   */
  emit(event: SystemEvent): Promise<void>;
  /**
   * Process event queue
   */
  private processQueue;
  /**
   * Process individual event
   */
  private processEvent;
  /**
   * Synchronous emit for internal use
   */
  private emitSync;
  /**
   * Get event history with filtering
   */
  getHistory(options?: {
    eventType?: string;
    source?: string;
    entityId?: string;
    since?: number;
    limit?: number;
  }): SystemEvent[];
  /**
   * Create event correlation tracking
   */
  createCorrelation(correlationId: string): EventCorrelation;
  /**
   * Batch emit multiple events
   */
  emitBatch(events: SystemEvent[]): Promise<void>;
  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring;
  /**
   * Get event bus statistics
   */
  getStats(): {
    queueSize: number;
    historySize: number;
    subscriptionCount: number;
    activeSubscriptions: number;
    eventsProcessed: number;
    handlersExecuted: number;
    averageProcessingTime: number;
    errorCount: number;
  };
  /**
   * Clear all subscriptions and history
   */
  clear(): void;
  private generateId;
}
/**
 * Event correlation for tracking related events
 */
export declare class EventCorrelation {
  readonly id: string;
  private eventBus;
  private events;
  constructor(id: string, eventBus: UnifiedEventBus);
  /**
   * Emit event with correlation
   */
  emit(event: Omit<SystemEvent, "metadata">): Promise<void>;
  /**
   * Get all correlated events
   */
  getEvents(): SystemEvent[];
  /**
   * Wait for specific event in correlation
   */
  waitFor(eventType: string, timeout?: number): Promise<SystemEvent>;
}
export declare const _globalEventBus: UnifiedEventBus;
export declare const _GameEvents: {
  combatStart: (entityId: string, data: any) => GameEvent;
  combatEnd: (data: any) => GameEvent;
  spellCast: (entityId: string, targetId: string, spellData: any) => GameEvent;
  damageDealt: (entityId: string, targetId: string, damage: number, type?: string) => GameEvent;
  sessionCreated: (sessionId: string, sessionName: string) => GameEvent;
  sessionEnded: (sessionId: string) => GameEvent;
};
export declare const _AIEvents: {
  decisionMade: (entityId: string, decision: any) => AIEvent;
  behaviorChanged: (entityId: string, oldBehavior: string, newBehavior: string) => AIEvent;
  stateTransition: (entityId: string, fromState: string, toState: string) => AIEvent;
};
export declare const _ContentEvents: {
  assetCreated: (assetId: string, assetType: string, data: any) => ContentEvent;
  generationRequested: (prompt: string, type: string, options?: any) => ContentEvent;
  generationCompleted: (assetId: string, generationData: any) => ContentEvent;
  contentGenerated: (contentType: string, assetId: string, content: any) => ContentEvent;
};
export declare const _RuleEvents: {
  ruleEvaluated: (ruleId: string, result: boolean, context: any) => RuleEvent;
  effectApplied: (ruleId: string, effect: any, target: string) => RuleEvent;
  workflowStarted: (workflowId: string, parameters: any) => RuleEvent;
};
//# sourceMappingURL=EventBus.d.ts.map
