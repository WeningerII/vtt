import { EventEmitter } from 'events';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  monitoringPeriod?: number;
  halfOpenRequests?: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: Date | undefined;
  nextRetryTime: Date | undefined;
  totalRequests: number;
  failureRate: number;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private totalRequests = 0;
  private lastFailureTime: Date | undefined;
  private nextRetryTime: Date | undefined;
  private halfOpenRequests = 0;
  
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly monitoringPeriod: number;
  private readonly maxHalfOpenRequests: number;
  
  private monitoringWindow: { timestamp: Date; success: boolean }[] = [];

  constructor(private name: string, options: CircuitBreakerOptions = {}) {
    super();
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 60000; // 60 seconds
    this.monitoringPeriod = options.monitoringPeriod ?? 10000; // 10 seconds
    this.maxHalfOpenRequests = options.halfOpenRequests ?? 3;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new Error(`Circuit breaker is OPEN for ${this.name}`);
    }

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenRequests++;
    }

    this.totalRequests++;
    const startTime = Date.now();

    try {
      const result = await fn();
      this.onSuccess();
      this.emit('success', { provider: this.name, duration: Date.now() - startTime });
      return result;
    } catch (error) {
      this.onFailure();
      this.emit('failure', { provider: this.name, error, duration: Date.now() - startTime });
      throw error;
    }
  }

  private canExecute(): boolean {
    this.cleanMonitoringWindow();

    switch (this.state) {
      case CircuitState.CLOSED:
        return true;
      
      case CircuitState.OPEN:
        if (this.nextRetryTime && Date.now() >= this.nextRetryTime.getTime()) {
          this.transitionToHalfOpen();
          return true;
        }
        return false;
      
      case CircuitState.HALF_OPEN:
        return this.halfOpenRequests < this.maxHalfOpenRequests;
      
      default:
        return false;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.monitoringWindow.push({ timestamp: new Date(), success: true });

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        if (this.halfOpenRequests >= this.maxHalfOpenRequests) {
          this.transitionToClosed();
        }
        break;
      
      case CircuitState.CLOSED:
        // Reset failure count on success in closed state
        if (this.failures > 0) {
          this.failures = Math.max(0, this.failures - 1);
        }
        break;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    this.monitoringWindow.push({ timestamp: new Date(), success: false });

    switch (this.state) {
      case CircuitState.CLOSED:
        if (this.getRecentFailureRate() >= this.getFailureThresholdRate()) {
          this.transitionToOpen();
        }
        break;
      
      case CircuitState.HALF_OPEN:
        this.transitionToOpen();
        break;
    }
  }

  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextRetryTime = new Date(Date.now() + this.resetTimeout);
    this.emit('stateChange', { provider: this.name, from: this.state, to: CircuitState.OPEN });
  }

  private transitionToHalfOpen(): void {
    const previousState = this.state;
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenRequests = 0;
    this.emit('stateChange', { provider: this.name, from: previousState, to: CircuitState.HALF_OPEN });
  }

  private transitionToClosed(): void {
    const previousState = this.state;
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.halfOpenRequests = 0;
    this.nextRetryTime = undefined as Date | undefined;
    this.emit('stateChange', { provider: this.name, from: previousState, to: CircuitState.CLOSED });
  }

  private cleanMonitoringWindow(): void {
    const cutoff = Date.now() - this.monitoringPeriod;
    this.monitoringWindow = this.monitoringWindow.filter(
      entry => entry.timestamp.getTime() > cutoff
    );
  }

  private getRecentFailureRate(): number {
    this.cleanMonitoringWindow();
    if (this.monitoringWindow.length === 0) return 0;
    
    const failures = this.monitoringWindow.filter(e => !e.success).length;
    return failures / this.monitoringWindow.length;
  }

  private getFailureThresholdRate(): number {
    // Consider circuit open if failure rate exceeds 50% or absolute threshold
    return Math.min(0.5, this.failureThreshold / Math.max(1, this.monitoringWindow.length));
  }

  getStats(): CircuitBreakerStats {
    this.cleanMonitoringWindow();
    
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.nextRetryTime,
      totalRequests: this.totalRequests,
      failureRate: this.getRecentFailureRate()
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.totalRequests = 0;
    this.halfOpenRequests = 0;
    this.lastFailureTime = undefined;
    this.nextRetryTime = undefined;
    this.monitoringWindow = [];
    this.emit('reset', { provider: this.name });
  }
}

export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  getBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker(name, options);
      this.breakers.set(name, breaker);
    }
    return this.breakers.get(name)!;
  }

  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  reset(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
    }
  }
}

// Global registry instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry();
