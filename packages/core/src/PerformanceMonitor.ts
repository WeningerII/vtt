/**
 * Performance Monitor - Unified performance tracking across all VTT systems
 * Provides comprehensive metrics, profiling, and optimization insights
 */

import { EventEmitter, PerformanceEvents } from './EventEmitter';
import { logger } from '@vtt/logging';
import { 
  PerformanceMonitor as IPerformanceMonitor, 
  PerformanceProfiler, 
  PerformanceMeasurement, 
  PerformanceMetrics, 
  PerformanceStats,
  MemoryInfo,
  MemoryMeasurement,
  Disposable 
} from './SharedInterfaces';

export interface PerformanceConfig {
  maxMeasurements: number;
  enableMemoryTracking: boolean;
  enableGCTracking: boolean;
  profilerTimeout: number;
  warningThresholds: {
    frameTime: number;
    memoryUsage: number;
    operationDuration: number;
  };
}

export class PerformanceProfilerImpl implements PerformanceProfiler {
  public readonly name: string;
  public readonly startTime: number;
  private tags: Record<string, string> = {};
  private memoryStart?: MemoryMeasurement;

  constructor(name: string, trackMemory: boolean = false) {
    this.name = name;
    this.startTime = performance.now();
    
    if (trackMemory && (performance as any).memory) {
      const memory = (performance as any).memory;
      this.memoryStart = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        delta: 0
      };
    }
  }

  addTag(key: string, value: string): void {
    this.tags[key] = value;
  }

  getTags(): Record<string, string> {
    return { ...this.tags };
  }

  getElapsedTime(): number {
    return performance.now() - this.startTime;
  }

  getMemoryDelta(): MemoryMeasurement | null {
    if (!this.memoryStart || !(performance as any).memory) return null;
    
    const current = (performance as any).memory;
    return {
      used: current.usedJSHeapSize,
      total: current.totalJSHeapSize,
      delta: current.usedJSHeapSize - this.memoryStart.used
    };
  }

  end(): PerformanceMeasurement {
    const duration = this.getElapsedTime();
    const memory = this.getMemoryDelta();
    return {
      name: this.name,
      duration,
      timestamp: this.startTime,
      tags: this.getTags(),
      ...(memory && { memory })
    };
  }
}

export class PerformanceMonitorImpl extends EventEmitter<PerformanceEvents> implements IPerformanceMonitor, Disposable {
  private measurements: PerformanceMeasurement[] = [];
  private counters = new Map<string, number>();
  private activeProfilers = new Map<string, PerformanceProfilerImpl>();
  
  private config: PerformanceConfig;
  private frameCount = 0;
  private lastFrameTime = 0;
  private frameStartTime = 0;
  private frameTimes: number[] = [];
  private isMonitoringMemory = false;
  private memoryInterval: ReturnType<typeof setInterval> | undefined;
  private gcObserver?: PerformanceObserver;

  // FPS tracking
  private fpsCounter = 0;
  private fpsStartTime = 0;
  private currentFPS = 0;

  constructor(config: Partial<PerformanceConfig> = {}) {
    super();
    
    this.config = {
      maxMeasurements: 1000,
      enableMemoryTracking: true,
      enableGCTracking: true,
      profilerTimeout: 30000, // 30 seconds
      warningThresholds: {
        frameTime: 16.67, // 60 FPS threshold
        memoryUsage: 0.8, // 80% of available memory
        operationDuration: 100 // 100ms for operations
      },
      ...config
    };

    this.initializePerformanceObservers();
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.config.enableMemoryTracking) {
      this.startMemoryTracking();
    }
    
    if (this.config.enableGCTracking) {
      this.startGCTracking();
    }
    
    this.frameStartTime = performance.now();
    this.fpsStartTime = performance.now();
  }

  private startMemoryTracking(): void {
    this.isMonitoringMemory = true;
    this.memoryInterval = setInterval(() => {
      const memoryInfo = this.getMemoryInfo();
      const usage = memoryInfo.used / memoryInfo.total;
      if (usage > this.config.warningThresholds.memoryUsage) {
        this.emit('memory_warning', { usage, threshold: this.config.warningThresholds.memoryUsage });
      }
    }, 5000);
  }

  private startGCTracking(): void {
    try {
      this.gcObserver = new PerformanceObserver((_list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'gc') {
            this.emit('gc_detected', {
              type: (entry as any).kind || 'unknown',
              duration: entry.duration
            });
          }
        }
      });
      this.gcObserver.observe({ entryTypes: ['gc'] });
    } catch (_error) {
      // GC observation not supported
    }
  }

  /**
   * Start a performance profiler
   */
  startProfiling(name: string, trackMemory: boolean = false): PerformanceProfiler {
    return this.startProfiler(name, trackMemory);
  }

  startProfiler(name: string, trackMemory: boolean = false): PerformanceProfiler {
    const profiler = new PerformanceProfilerImpl(name, trackMemory || this.config.enableMemoryTracking);
    this.activeProfilers.set(name, profiler);

    // Set timeout to auto-end long-running profilers
    setTimeout(() => {
      if (this.activeProfilers.has(name)) {
        logger.warn(`Profiler '${name}' exceeded timeout, auto-ending`);
        this.endProfiling(profiler);
      }
    }, this.config.profilerTimeout);

    return profiler;
  }

  /**
   * End a performance profiler
   */
  endProfiling(profiler: PerformanceProfiler): PerformanceMeasurement {
    const measurement = (profiler as PerformanceProfilerImpl).end();
    this.measurements.push(measurement);
    this.activeProfilers.delete(profiler.name);

    this.emit('measurement_added', {
      name: measurement.name,
      duration: measurement.duration
    });

    return measurement;
  }

  endProfiler(name: string): PerformanceMeasurement | null {
    const profiler = this.activeProfilers.get(name);
    if (!profiler) {
      return null;
    }

    return this.endProfiling(profiler);
  }

  /**
   * Measure a synchronous operation
   */
  measure<T>(name: string, _fn: () => T): T {
    const profiler = this.startProfiler(name);
    
    try {
      const result = fn();
      this.endProfiling(profiler);
      return result;
    } catch (error) {
      this.endProfiling(profiler);
      throw error;
    }
  }

  /**
   * Measure an asynchronous operation
   */
  async measureAsync<T>(name: string, _fn: () => Promise<T>): Promise<T> {
    const profiler = this.startProfiler(name);
    
    try {
      const result = await fn();
      this.endProfiling(profiler);
      return result;
    } catch (error) {
      this.endProfiling(profiler);
      throw error;
    }
  }

  /**
   * Add a measurement manually
   */
  addMeasurement(name: string, duration: number, tags?: Record<string, string>): void {
    const measurement: PerformanceMeasurement = {
      name,
      duration,
      timestamp: performance.now(),
      tags: tags || {}
    };
    this.recordMeasurement(measurement);
  }

  /**
   * Get measurements by name
   */
  getMeasurements(name?: string): PerformanceMeasurement[] {
    if (name) {
      return this.measurements.filter(m => m.name === name);
    }
    return [...this.measurements];
  }

  /**
   * Clear all measurements
   */
  clearMeasurements(): void {
    this.measurements = [];
  }

  /**
   * Track FPS
   */
  trackFPS(_fps: number, _frameTime: number): void {
    this.endFrame();
  }

  /**
   * Get performance stats
   */
  getStats(): PerformanceStats {
    const durations = this.measurements.map(m => m.duration);
    const sortedDurations = durations.sort((_a, __b) => a - b);
    const frameTimes = this.frameTimes.length > 0 ? this.frameTimes : [0];
    
    return {
      totalMeasurements: this.measurements.length,
      averageDuration: durations.length > 0 ? durations.reduce((_a, __b) => a + b, 0) / durations.length : 0,
      averageFrameTime: frameTimes.reduce((_a, __b) => a + b, 0) / frameTimes.length,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      p50: sortedDurations[Math.floor(sortedDurations.length * 0.5)] || 0,
      p95: sortedDurations[Math.floor(sortedDurations.length * 0.95)] || 0,
      p99: sortedDurations[Math.floor(sortedDurations.length * 0.99)] || 0,
      counters: Object.fromEntries(this.counters),
      gauges: Record<string, any>
    };
  }

  /**
   * Increment counter
   */
  increment(counter: string, value: number = 1): void {
    const current = this.counters.get(counter) || 0;
    this.counters.set(counter, current + value);
  }

  /**
   * Decrement counter
   */
  decrement(counter: string, value: number = 1): void {
    const current = this.counters.get(counter) || 0;
    this.counters.set(counter, current - value);
  }

  /**
   * Set gauge value
   */
  gauge(metric: string, value: number): void {
    this.counters.set(metric, value);
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, tags?: Record<string, string>): void {
    const key = tags ? `${name}:${Object.entries(tags).map([k, _v] => `${k}=${v}`).join(',')}` : name;
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
  }

  /**
   * Start frame timing
   */
  startFrame(): void {
    this.frameStartTime = performance.now();
  }

  /**
   * End frame timing and track FPS
   */
  endFrame(): void {
    if (this.frameStartTime === 0) return;
    
    const frameTime = performance.now() - this.frameStartTime;
    this.frameTimes.push(frameTime);
    
    // Keep only last 60 frame times
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }

    // Calculate FPS
    this.fpsCounter++;
    const currentTime = performance.now();
    
    if (this.fpsStartTime === 0) {
      this.fpsStartTime = currentTime;
    } else if (currentTime - this.fpsStartTime >= 1000) {
      this.currentFPS = this.fpsCounter;
      this.fpsCounter = 0;
      this.fpsStartTime = currentTime;
      
      this.emit('fps', { fps: this.currentFPS, frameTime });
    }

    // Check for performance issues
    if (frameTime > this.config.warningThresholds.frameTime) {
      this.emit('fps_drop', {
        fps: this.currentFPS,
        previousFps: this.currentFPS
      });
    }

    this.frameCount++;
    this.lastFrameTime = frameTime;
    this.frameStartTime = 0;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const stats = this.getStats();
    const memory = this.getMemoryInfo();
    return {
      ...stats,
      fps: this.currentFPS,
      frameCount: this.frameCount,
      memoryUsage: memory
    };
  }

  /**
   * Record a custom metric
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const measurement: PerformanceMeasurement = {
      name,
      duration: value,
      timestamp: performance.now(),
      tags: tags || {}
    };
    this.recordMeasurement(measurement);
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring(): void {
    if (this.isMonitoringMemory) return;
    
    this.isMonitoringMemory = true;
    
    this.memoryInterval = setInterval(() => {
      const memory = this.getMemoryInfo();
      
      const used = memory.used;
      const total = memory.total;
      const usage = used / total;
      
      this.emit('memory', { used, total, usage, threshold: this.config.warningThresholds.memoryUsage });

      // Check memory warnings
      if (memory.total > 0 && memory.used / memory.total > this.config.warningThresholds.memoryUsage) {
        this.emit('memory_warning', {
          usage,
          threshold: this.config.warningThresholds.memoryUsage
        });
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop memory monitoring
   */
  stopMemoryMonitoring(): void {
    this.isMonitoringMemory = false;
    
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = undefined;
    }
  }

  /**
   * Clear all performance data
   */
  reset(): void {
    this.measurements = [];
    this.counters.clear();
    this.frameTimes = [];
    this.frameCount = 0;
    this.fpsCounter = 0;
    this.currentFPS = 0;
    this.fpsStartTime = 0;
  }

  /**
   * Dispose of the performance monitor
   */
  dispose(): void {
    this.stopMemoryMonitoring();
    
    if (this.gcObserver) {
      this.gcObserver.disconnect();
    }
    
    // End any active profilers
    for (const [_name, profiler] of this.activeProfilers.entries()) {
      const measurement = profiler.end();
      this.recordMeasurement(measurement);
    }
    this.activeProfilers.clear();
    
    this.reset();
    this.removeAllListeners();
  }

  // Private helper methods

  private recordMeasurement(measurement: PerformanceMeasurement): void {
    this.measurements.push(measurement);
    
    // Keep only the most recent measurements
    if (this.measurements.length > this.config.maxMeasurements) {
      this.measurements.shift();
    }

    // Emit performance event
    this.emit('measurement', measurement);

    // Check for performance issues
    if (measurement.duration > this.config.warningThresholds.operationDuration) {
      this.emit('performance_issue', {
        type: 'high_duration',
        severity: 'warning' as const,
        details: { measurement, threshold: this.config.warningThresholds.operationDuration }
      });
    }
  }

  getMemoryInfo(): MemoryInfo {
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      return {
        used: memory?.usedJSHeapSize || 0,
        total: memory?.totalJSHeapSize || 0,
        limit: memory?.jsHeapSizeLimit || 0,
        available: memory ? memory.totalJSHeapSize - memory.usedJSHeapSize : 0
      };
    }

    // Fallback for environments without memory API
    return {
      used: 0,
      total: 0,
      limit: 0,
      available: 0
    };
  }

  private initializePerformanceObservers(): void {
    // Set up GC observer if available
    if (this.config.enableGCTracking && typeof PerformanceObserver !== 'undefined') {
      try {
        this.gcObserver = new PerformanceObserver((_list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            if (entry.entryType === 'measure' && entry.name.includes('gc')) {
              this.recordMetric('garbage_collection', entry.duration, {
                type: entry.name
              });
            }
          }
        });
        
        this.gcObserver.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
      } catch (error) {
        logger.warn('Failed to initialize performance observer:', error);
      }
    }
  }
}

// Export singleton instance
export const _performanceMonitor = new PerformanceMonitorImpl();
