import { logger } from "@vtt/logging";

/**
 * Shared EventEmitter implementation for the VTT platform
 * Provides type-safe event handling with performance optimizations
 */

export interface EventMap {
  [event: string]: any;
}

export interface SystemEvents {
  ready: undefined;
  error: Error;
  disposed: undefined;
}

export interface PerformanceEvents extends SystemEvents {
  measurement_added: { name: string; duration: number };
  fps_update: { fps: number; frameTime: number };
  fps: { fps: number; frameTime: number };
  fps_drop: { fps: number; previousFps: number };
  memory_warning: { usage: number; threshold: number };
  memory: { used: number; total: number; usage: number; threshold: number };
  gc_detected: { type: string; duration: number };
  measurement: { name: string; duration: number; tags: Record<string, string> };
  performance_issue: { type: string; severity: "warning" | "error"; details: any };
}

export type EventListener<T = any> = (_data: T) => void;

export class EventEmitter<TEvents extends EventMap = EventMap> {
  private listeners = new Map<keyof TEvents, Set<EventListener>>();
  private onceListeners = new Map<keyof TEvents, Set<EventListener>>();
  private maxListeners = 100;

  /**
   * Add an event listener
   */
  on<K extends keyof TEvents>(event: K, listener: EventListener<TEvents[K]>): this {
    this.addListener(event, listener, false);
    return this;
  }

  /**
   * Add a one-time event listener
   */
  once<K extends keyof TEvents>(event: K, listener: EventListener<TEvents[K]>): this {
    this.addListener(event, listener, true);
    return this;
  }

  /**
   * Remove an event listener
   */
  off<K extends keyof TEvents>(event: K, listener: EventListener<TEvents[K]>): this {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }

    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      onceListeners.delete(listener);
      if (onceListeners.size === 0) {
        this.onceListeners.delete(event);
      }
    }

    return this;
  }

  /**
   * Emit an event
   */
  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): boolean {
    let hasListeners = false;

    // Handle regular listeners
    const listeners = this.listeners.get(event);
    if (listeners && listeners.size > 0) {
      hasListeners = true;
      for (const listener of Array.from(listeners)) {
        try {
          listener(data);
        } catch (error) {
          logger.error(`Error in event listener for ${String(event)}:`, error as Record<string, any>);
        }
      }
    }

    // Handle once listeners
    const onceListeners = this.onceListeners.get(event);
    if (onceListeners && onceListeners.size > 0) {
      hasListeners = true;
      const listenersArray = Array.from(onceListeners);
      this.onceListeners.delete(event);

      for (const listener of listenersArray) {
        try {
          listener(data);
        } catch (error) {
          logger.error(`Error in one-time event listener for ${String(event)}:`, error as Record<string, any>);
        }
      }
    }

    return hasListeners;
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners<K extends keyof TEvents>(event?: K): this {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
    return this;
  }

  /**
   * Get listener count for an event
   */
  listenerCount<K extends keyof TEvents>(event: K): number {
    const listeners = this.listeners.get(event);
    const onceListeners = this.onceListeners.get(event);
    return (listeners?.size || 0) + (onceListeners?.size || 0);
  }

  /**
   * Get all events that have listeners
   */
  eventNames(): Array<keyof TEvents> {
    const events = new Set<keyof TEvents>();
    for (const event of this.listeners.keys()) {
      events.add(event);
    }
    for (const event of this.onceListeners.keys()) {
      events.add(event);
    }
    return Array.from(events);
  }

  /**
   * Set maximum number of listeners per event
   */
  setMaxListeners(max: number): this {
    this.maxListeners = max;
    return this;
  }

  /**
   * Pipe events from another emitter
   */
  pipe<TOther extends EventMap>(
    other: EventEmitter<TOther>,
    eventMap?: Partial<Record<keyof TOther, keyof TEvents>>,
  ): () => void {
    const unsubscribers: Array<() => void> = [];

    if (eventMap) {
      // Pipe specific events with mapping
      for (const [sourceEvent, targetEvent] of Object.entries(eventMap)) {
        const listener = (_data: any) => this.emit(targetEvent as keyof TEvents, _data);
        other.on(sourceEvent as keyof TOther, listener);
        unsubscribers.push(() => other.off(sourceEvent as keyof TOther, listener));
      }
    } else {
      // Pipe all events (assuming compatible event maps)
      const otherEventNames = other.eventNames();
      for (const event of otherEventNames) {
        const listener = (_data: any) => this.emit(event as keyof TEvents, _data);
        other.on(event, listener);
        unsubscribers.push(() => other.off(event, listener));
      }
    }

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }

  private addListener<K extends keyof TEvents>(
    event: K,
    listener: EventListener<TEvents[K]>,
    once: boolean,
  ): void {
    const listenersMap = once ? this.onceListeners : this.listeners;

    if (!listenersMap.has(event)) {
      listenersMap.set(event, new Set());
    }

    const listeners = listenersMap.get(event)!;

    if (listeners.size >= this.maxListeners) {
      logger.warn(
        `Maximum number of listeners (${this.maxListeners}) exceeded for event ${String(event)}`,
      );
    }

    listeners.add(listener);
  }
}
