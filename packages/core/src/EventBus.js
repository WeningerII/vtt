import { logger } from "@vtt/logging";
export class UnifiedEventBus {
  constructor() {
    this.subscriptions = new Map();
    this.eventHistory = [];
    this.maxHistorySize = 1000;
    this.eventQueue = [];
    this.processing = false;
    this.stats = {
      eventsProcessed: 0,
      handlersExecuted: 0,
      averageProcessingTime: 0,
      errorCount: 0,
    };
    this.setupPerformanceMonitoring();
  }
  /**
   * Subscribe to events with priority and filtering
   */
  on(_eventType, _handler, options = {}) {
    const subscription = {
      id: this.generateId(),
      eventType,
      handler: options.filter
        ? (event) => {
            if (options.filter(event)) {
              return handler(event);
            }
          }
        : handler,
      once: options.once || false,
      priority: options.priority || 0,
      active: true,
    };
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }
    const handlers = this.subscriptions.get(eventType);
    handlers.push(subscription);
    // Sort by priority (higher priority first)
    handlers.sort((_a, _b) => b.priority - a.priority);
    return subscription.id;
  }
  /**
   * Subscribe to event once
   */
  once(_eventType, _handler, options = {}) {
    return this.on(eventType, handler, { ...options, once: true });
  }
  /**
   * Unsubscribe from events
   */
  off(subscriptionId) {
    for (const [eventType, handlers] of this.subscriptions.entries()) {
      const index = handlers.findIndex((h) => h.id === subscriptionId);
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
  async emit(event) {
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
  async processQueue() {
    this.processing = true;
    const startTime = performance.now();
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      await this.processEvent(event);
    }
    this.processing = false;
    // Update stats
    const processingTime = performance.now() - startTime;
    this.stats.averageProcessingTime = (this.stats.averageProcessingTime + processingTime) / 2;
  }
  /**
   * Process individual event
   */
  async processEvent(event) {
    const handlers = this.subscriptions.get(event.type) || [];
    const globalHandlers = this.subscriptions.get("*") || [];
    const allHandlers = [...handlers, ...globalHandlers].filter((h) => h.active);
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
          type: "handler_error",
          source: "event_bus",
          timestamp: Date.now(),
          data: {
            originalEvent: event,
            error: error instanceof Error ? error.message : String(error),
            handlerId: subscription.id,
          },
        });
      }
    }
  }
  /**
   * Synchronous emit for internal use
   */
  emitSync(event) {
    // Add to history only
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }
  /**
   * Get event history with filtering
   */
  getHistory(options = {}) {
    let events = this.eventHistory;
    if (options.eventType) {
      events = events.filter((e) => e.type === options.eventType);
    }
    if (options.source) {
      events = events.filter((e) => e.source === options.source);
    }
    if (options.entityId) {
      events = events.filter(
        (e) =>
          ("entityId" in e && e.entityId === options.entityId) ||
          ("assetId" in e && e.assetId === options.entityId),
      );
    }
    if (options.since) {
      events = events.filter((e) => e.timestamp >= options.since);
    }
    if (options.limit) {
      events = events.slice(-options.limit);
    }
    return events;
  }
  /**
   * Create event correlation tracking
   */
  createCorrelation(correlationId) {
    return new EventCorrelation(correlationId, this);
  }
  /**
   * Batch emit multiple events
   */
  async emitBatch(events) {
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
  setupPerformanceMonitoring() {
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
      subscriptionCount: Array.from(this.subscriptions.values()).reduce(
        (_sum, _handlers) => sum + handlers.length,
        0,
      ),
      activeSubscriptions: Array.from(this.subscriptions.values()).reduce(
        (_sum, _handlers) => sum + handlers.filter((h) => h.active).length,
        0,
      ),
    };
  }
  /**
   * Clear all subscriptions and history
   */
  clear() {
    this.subscriptions.clear();
    this.eventHistory = [];
    this.eventQueue = [];
    this.processing = false;
  }
  generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}
/**
 * Event correlation for tracking related events
 */
export class EventCorrelation {
  constructor(id, eventBus) {
    this.id = id;
    this.eventBus = eventBus;
    this.events = [];
  }
  /**
   * Emit event with correlation
   */
  async emit(event) {
    const correlatedEvent = {
      ...event,
      metadata: {
        correlationId: this.id,
      },
    };
    this.events.push(correlatedEvent);
    await this.eventBus.emit(correlatedEvent);
  }
  /**
   * Get all correlated events
   */
  getEvents() {
    return [...this.events];
  }
  /**
   * Wait for specific event in correlation
   */
  async waitFor(eventType, timeout = 5000) {
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
  combatStart: (entityId, data) => ({
    type: "combat_start",
    source: "game",
    timestamp: Date.now(),
    entityId,
    data,
  }),
  combatEnd: (data) => ({
    type: "combat_end",
    source: "game",
    timestamp: Date.now(),
    data,
  }),
  spellCast: (entityId, targetId, spellData) => ({
    type: "spell_cast",
    source: "game",
    timestamp: Date.now(),
    entityId,
    targetId,
    data: spellData,
  }),
  damageDealt: (entityId, targetId, damage, type) => ({
    type: "damage_dealt",
    source: "game",
    timestamp: Date.now(),
    entityId,
    targetId,
    data: { damage, type },
  }),
  sessionCreated: (sessionId, sessionName) => ({
    type: "session_created",
    source: "game",
    timestamp: Date.now(),
    sessionId,
    data: { sessionName },
  }),
  sessionEnded: (sessionId) => ({
    type: "session_ended",
    source: "game",
    timestamp: Date.now(),
    sessionId,
    data: Record,
  }),
};
export const _AIEvents = {
  decisionMade: (entityId, decision) => ({
    type: "decision_made",
    source: "ai",
    timestamp: Date.now(),
    entityId,
    data: decision,
  }),
  behaviorChanged: (entityId, oldBehavior, newBehavior) => ({
    type: "behavior_changed",
    source: "ai",
    timestamp: Date.now(),
    entityId,
    data: { oldBehavior, newBehavior },
  }),
  stateTransition: (entityId, fromState, toState) => ({
    type: "state_transition",
    source: "ai",
    timestamp: Date.now(),
    entityId,
    data: { fromState, toState },
  }),
};
export const _ContentEvents = {
  assetCreated: (assetId, assetType, data) => ({
    type: "asset_created",
    source: "content",
    timestamp: Date.now(),
    assetId,
    assetType,
    data,
  }),
  generationRequested: (prompt, type, options) => ({
    type: "generation_requested",
    source: "content",
    timestamp: Date.now(),
    data: { prompt, type, options },
  }),
  generationCompleted: (assetId, generationData) => ({
    type: "generation_completed",
    source: "content",
    timestamp: Date.now(),
    assetId,
    data: generationData,
  }),
  contentGenerated: (contentType, assetId, content) => ({
    type: "content_generated",
    source: "content",
    timestamp: Date.now(),
    assetId,
    data: { contentType, content },
  }),
};
export const _RuleEvents = {
  ruleEvaluated: (ruleId, result, context) => ({
    type: "rule_evaluated",
    source: "rules",
    timestamp: Date.now(),
    ruleId,
    data: { result, context },
  }),
  effectApplied: (ruleId, effect, target) => ({
    type: "effect_applied",
    source: "rules",
    timestamp: Date.now(),
    ruleId,
    data: { effect, target },
  }),
  workflowStarted: (workflowId, parameters) => ({
    type: "workflow_started",
    source: "rules",
    timestamp: Date.now(),
    workflowId,
    data: parameters,
  }),
};
//# sourceMappingURL=EventBus.js.map
