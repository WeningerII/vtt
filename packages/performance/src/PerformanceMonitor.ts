/**
 * Performance Monitoring System
 * Real-time performance tracking, profiling, and optimization recommendations
 */

import { EventEmitter } from 'events';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  category: 'memory' | 'cpu' | 'network' | 'render' | 'user' | 'custom';
  tags?: Record<string, string>;
}

export interface PerformanceSample {
  id: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  name: string;
  category: string;
  metadata?: Record<string, any>;
  children?: PerformanceSample[];
}

export interface PerformanceReport {
  timeRange: { start: number; end: number };
  metrics: PerformanceMetric[];
  samples: PerformanceSample[];
  summary: {
    averageFrameTime: number;
    memoryUsage: number;
    cpuUsage: number;
    networkLatency: number;
    errorCount: number;
  };
  recommendations: PerformanceRecommendation[];
}

export interface PerformanceRecommendation {
  type: 'memory' | 'cpu' | 'network' | 'render' | 'optimization';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: string;
  suggestedActions: string[];
  estimatedImpact: number; // 0-1
}

export interface MonitoringConfig {
  sampleRate: number; // 0-1, how often to collect metrics
  maxSamples: number;
  maxMetrics: number;
  enableAutomaticProfiling: boolean;
  performanceThresholds: {
    frameTime: number; // ms
    memoryUsage: number; // bytes
    cpuUsage: number; // 0-1
    networkLatency: number; // ms
  };
  alertThresholds: {
    consecutiveSlowFrames: number;
    memoryLeakDetection: boolean;
    highCpuUsage: number; // consecutive samples
  };
}

export class PerformanceMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private metrics: PerformanceMetric[] = [];
  private samples: PerformanceSample[] = [];
  private activeSamples = new Map<string, PerformanceSample>();
  private frameTimings: number[] = [];
  private memoryHistory: number[] = [];
  private cpuHistory: number[] = [];
  private networkHistory: number[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.startSystemMetrics();
    this.startFrameTimeMonitoring();
    
    this.emit('monitoringStarted');
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      delete (this as any).monitoringInterval;
    }

    this.emit('monitoringStopped');
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: performance.now(),
    };

    this.metrics.push(fullMetric);
    
    // Keep metrics within limit
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics.shift();
    }

    this.emit('metricRecorded', fullMetric);
    this.checkThresholds(fullMetric);
  }

  /**
   * Start a performance sample (profiling)
   */
  startSample(name: string, category = 'custom', metadata?: Record<string, any>): string {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const sample: PerformanceSample = {
      id,
      name,
      category,
      startTime: performance.now(),
      metadata: metadata || {},
      children: [],
    };

    this.activeSamples.set(id, sample);
    this.emit('sampleStarted', sample);
    
    return id;
  }

  /**
   * End a performance sample
   */
  endSample(id: string): PerformanceSample | null {
    const sample = this.activeSamples.get(id);
    if (!sample) return null;

    sample.endTime = performance.now();
    sample.duration = sample.endTime - sample.startTime;

    this.activeSamples.delete(id);
    this.samples.push(sample);

    // Keep samples within limit
    if (this.samples.length > this.config.maxSamples) {
      this.samples.shift();
    }

    this.emit('sampleEnded', sample);
    return sample;
  }

  /**
   * Measure execution time of a function
   */
  async measure<T>(
    name: string, 
    fn: () => T | Promise<T>,
    category = 'custom',
    metadata?: Record<string, any>
  ): Promise<{ result: T; duration: number }> {
    const sampleId = this.startSample(name, category, metadata);
    
    try {
      const result = await fn();
      const sample = this.endSample(sampleId);
      
      return {
        result,
        duration: sample?.duration || 0,
      };
    } catch (error) {
      this.endSample(sampleId);
      this.recordMetric({
        name: 'error',
        value: 1,
        unit: 'count',
        category: 'user',
        tags: { function: name, error: error instanceof Error ? error.message : 'Unknown' },
      });
      throw error;
    }
  }

  /**
   * Get current performance report
   */
  getReport(timeRange?: { start: number; end: number }): PerformanceReport {
    const now = performance.now();
    const range = timeRange || { start: now - 60000, end: now }; // Last minute

    // Filter metrics and samples by time range
    const filteredMetrics = this.metrics.filter(m => 
      m.timestamp >= range.start && m.timestamp <= range.end
    );
    
    const filteredSamples = this.samples.filter(s => 
      s.startTime >= range.start && (s.endTime || s.startTime) <= range.end
    );

    // Calculate summary statistics
    const summary = this.calculateSummary(filteredMetrics, filteredSamples);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, filteredMetrics, filteredSamples);

    return {
      timeRange: range,
      metrics: filteredMetrics,
      samples: filteredSamples,
      summary,
      recommendations,
    };
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    totalMetrics: number;
    totalSamples: number;
    activeSamples: number;
    averageFrameTime: number;
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
    cpuTrend: 'increasing' | 'decreasing' | 'stable';
  } {
    const recentFrameTimes = this.frameTimings.slice(-100);
    const averageFrameTime = recentFrameTimes.length > 0
      ? recentFrameTimes.reduce((a, b) => a + b, 0) / recentFrameTimes.length
      : 0;

    return {
      totalMetrics: this.metrics.length,
      totalSamples: this.samples.length,
      activeSamples: this.activeSamples.size,
      averageFrameTime,
      memoryTrend: this.calculateTrend(this.memoryHistory),
      cpuTrend: this.calculateTrend(this.cpuHistory),
    };
  }

  /**
   * Export performance data for analysis
   */
  exportData(format: 'json' | 'csv'): string {
    const data = {
      metrics: this.metrics,
      samples: this.samples,
      config: this.config,
      timestamp: Date.now(),
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      return this.convertToCSV(data);
    }
  }

  /**
   * Clear all collected data
   */
  clear(): void {
    this.metrics = [];
    this.samples = [];
    this.frameTimings = [];
    this.memoryHistory = [];
    this.cpuHistory = [];
    this.networkHistory = [];
    this.activeSamples.clear();
    
    this.emit('dataCleared');
  }

  private startSystemMetrics(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 1000 / this.config.sampleRate);
  }

  private collectSystemMetrics(): void {
    // Memory metrics
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      const memoryUsage = memory.usedJSHeapSize;
      
      this.recordMetric({
        name: 'memory_usage',
        value: memoryUsage,
        unit: 'bytes',
        category: 'memory',
      });

      this.memoryHistory.push(memoryUsage);
      if (this.memoryHistory.length > 100) {
        this.memoryHistory.shift();
      }
    }

    // CPU usage estimation (simplified)
    const cpuUsage = this.estimateCpuUsage();
    this.recordMetric({
      name: 'cpu_usage',
      value: cpuUsage,
      unit: 'percentage',
      category: 'cpu',
    });

    this.cpuHistory.push(cpuUsage);
    if (this.cpuHistory.length > 100) {
      this.cpuHistory.shift();
    }

    // Network latency (if available)
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection && connection.rtt) {
        this.recordMetric({
          name: 'network_latency',
          value: connection.rtt,
          unit: 'ms',
          category: 'network',
        });

        this.networkHistory.push(connection.rtt);
        if (this.networkHistory.length > 100) {
          this.networkHistory.shift();
        }
      }
    }
  }

  private startFrameTimeMonitoring(): void {
    let lastFrameTime = performance.now();
    
    const measureFrame = () => {
      if (!this.isMonitoring) return;

      const currentTime = performance.now();
      const frameTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      this.frameTimings.push(frameTime);
      if (this.frameTimings.length > 1000) {
        this.frameTimings.shift();
      }

      this.recordMetric({
        name: 'frame_time',
        value: frameTime,
        unit: 'ms',
        category: 'render',
      });

      requestAnimationFrame(measureFrame);
    };

    requestAnimationFrame(measureFrame);
  }

  private estimateCpuUsage(): number {
    // Simple CPU usage estimation based on frame timing consistency
    const recentFrames = this.frameTimings.slice(-10);
    if (recentFrames.length < 5) return 0;

    const targetFrameTime = 16.67; // 60 FPS
    const averageFrameTime = recentFrames.reduce((a, b) => a + b, 0) / recentFrames.length;
    
    // Rough estimation: higher frame time = higher CPU usage
    return Math.min(1, Math.max(0, (averageFrameTime - targetFrameTime) / targetFrameTime));
  }

  private calculateSummary(metrics: PerformanceMetric[], _samples: PerformanceSample[]) {
    const frameTimeMetrics = metrics.filter(m => m.name === 'frame_time');
    const memoryMetrics = metrics.filter(m => m.name === 'memory_usage');
    const cpuMetrics = metrics.filter(m => m.name === 'cpu_usage');
    const networkMetrics = metrics.filter(m => m.name === 'network_latency');
    const errorMetrics = metrics.filter(m => m.name === 'error');

    return {
      averageFrameTime: frameTimeMetrics.length > 0
        ? frameTimeMetrics.reduce((sum, m) => sum + m.value, 0) / frameTimeMetrics.length
        : 0,
      memoryUsage: memoryMetrics.length > 0
        ? memoryMetrics[memoryMetrics.length - 1]?.value || 0
        : 0,
      cpuUsage: cpuMetrics.length > 0
        ? cpuMetrics.reduce((sum, m) => sum + m.value, 0) / cpuMetrics.length
        : 0,
      networkLatency: networkMetrics.length > 0
        ? networkMetrics.reduce((sum, m) => sum + m.value, 0) / networkMetrics.length
        : 0,
      errorCount: errorMetrics.length,
    };
  }

  private generateRecommendations(
    summary: any, 
    metrics: PerformanceMetric[], 
    samples: PerformanceSample[]
  ): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    // Frame time recommendations
    if (summary.averageFrameTime > this.config.performanceThresholds.frameTime) {
      recommendations.push({
        type: 'render',
        severity: summary.averageFrameTime > 33 ? 'high' : 'medium',
        message: 'Frame time is above target',
        details: `Average frame time: ${summary.averageFrameTime.toFixed(2)}ms (target: ${this.config.performanceThresholds.frameTime}ms)`,
        suggestedActions: [
          'Reduce complexity of rendering operations',
          'Implement object pooling for frequently created objects',
          'Use requestAnimationFrame for animations',
          'Consider level-of-detail (LOD) systems for distant objects'
        ],
        estimatedImpact: 0.7,
      });
    }

    // Memory recommendations
    if (summary.memoryUsage > this.config.performanceThresholds.memoryUsage) {
      recommendations.push({
        type: 'memory',
        severity: 'high',
        message: 'Memory usage is high',
        details: `Current memory usage: ${(summary.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
        suggestedActions: [
          'Implement garbage collection strategies',
          'Use object pooling for frequently allocated objects',
          'Clear unused references and event listeners',
          'Consider lazy loading for large assets'
        ],
        estimatedImpact: 0.8,
      });
    }

    // CPU recommendations
    if (summary.cpuUsage > this.config.performanceThresholds.cpuUsage) {
      recommendations.push({
        type: 'cpu',
        severity: summary.cpuUsage > 0.8 ? 'high' : 'medium',
        message: 'High CPU usage detected',
        details: `Average CPU usage: ${(summary.cpuUsage * 100).toFixed(1)}%`,
        suggestedActions: [
          'Optimize expensive algorithms',
          'Use web workers for heavy computations',
          'Implement caching for repeated calculations',
          'Reduce update frequency for non-critical systems'
        ],
        estimatedImpact: 0.6,
      });
    }

    // Network recommendations
    if (summary.networkLatency > this.config.performanceThresholds.networkLatency) {
      recommendations.push({
        type: 'network',
        severity: 'medium',
        message: 'High network latency detected',
        details: `Average latency: ${summary.networkLatency.toFixed(0)}ms`,
        suggestedActions: [
          'Implement request batching',
          'Use connection pooling',
          'Add offline capabilities',
          'Optimize payload sizes'
        ],
        estimatedImpact: 0.5,
      });
    }

    // Error rate recommendations
    if (summary.errorCount > 10) {
      recommendations.push({
        type: 'optimization',
        severity: 'high',
        message: 'High error rate detected',
        details: `${summary.errorCount} errors in the monitored period`,
        suggestedActions: [
          'Review error handling patterns',
          'Add comprehensive input validation',
          'Implement proper error boundaries',
          'Add logging and monitoring'
        ],
        estimatedImpact: 0.9,
      });
    }

    return recommendations;
  }

  private checkThresholds(metric: PerformanceMetric): void {
    if (metric.name === 'frame_time' && metric.value > this.config.performanceThresholds.frameTime) {
      const recentSlowFrames = this.frameTimings.slice(-this.config.alertThresholds.consecutiveSlowFrames)
        .filter(t => t > this.config.performanceThresholds.frameTime).length;

      if (recentSlowFrames >= this.config.alertThresholds.consecutiveSlowFrames) {
        this.emit('performanceAlert', {
          type: 'slowFrames',
          message: `${recentSlowFrames} consecutive slow frames detected`,
          metric,
        });
      }
    }

    if (metric.name === 'memory_usage' && this.config.alertThresholds.memoryLeakDetection) {
      const trend = this.calculateTrend(this.memoryHistory);
      if (trend === 'increasing' && this.memoryHistory.length >= 50) {
        this.emit('performanceAlert', {
          type: 'memoryLeak',
          message: 'Potential memory leak detected',
          metric,
        });
      }
    }
  }

  private calculateTrend(history: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (history.length < 10) return 'stable';

    const recentData = history.slice(-10);
    const olderData = history.slice(-20, -10);

    if (olderData.length === 0) return 'stable';

    const recentAvg = recentData.reduce((a, b) => a + b, 0) / recentData.length;
    const olderAvg = olderData.reduce((a, b) => a + b, 0) / olderData.length;

    const changeRatio = (recentAvg - olderAvg) / olderAvg;

    if (changeRatio > 0.1) return 'increasing';
    if (changeRatio < -0.1) return 'decreasing';
    return 'stable';
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - in practice would be more sophisticated
    let csv = 'timestamp,name,value,unit,category\n';
    
    for (const metric of data.metrics) {
      csv += `${metric.timestamp},${metric.name},${metric.value},${metric.unit},${metric.category}\n`;
    }

    return csv;
  }
}

/**
 * Default monitoring configurations
 */
export const _DEFAULT_MONITORING_CONFIGS = {
  // Development monitoring - detailed but not performance-impacting
  development: {
    sampleRate: 0.1, // 10% sampling
    maxSamples: 1000,
    maxMetrics: 5000,
    enableAutomaticProfiling: true,
    performanceThresholds: {
      frameTime: 20, // 50 FPS
      memoryUsage: 100 * 1024 * 1024, // 100MB
      cpuUsage: 0.7, // 70%
      networkLatency: 200, // 200ms
    },
    alertThresholds: {
      consecutiveSlowFrames: 5,
      memoryLeakDetection: true,
      highCpuUsage: 10,
    },
  } as MonitoringConfig,

  // Production monitoring - lightweight
  production: {
    sampleRate: 0.01, // 1% sampling
    maxSamples: 500,
    maxMetrics: 1000,
    enableAutomaticProfiling: false,
    performanceThresholds: {
      frameTime: 16.67, // 60 FPS
      memoryUsage: 200 * 1024 * 1024, // 200MB
      cpuUsage: 0.8, // 80%
      networkLatency: 100, // 100ms
    },
    alertThresholds: {
      consecutiveSlowFrames: 10,
      memoryLeakDetection: true,
      highCpuUsage: 20,
    },
  } as MonitoringConfig,

  // Performance testing - comprehensive
  testing: {
    sampleRate: 1.0, // 100% sampling
    maxSamples: 10000,
    maxMetrics: 50000,
    enableAutomaticProfiling: true,
    performanceThresholds: {
      frameTime: 10, // Very strict
      memoryUsage: 50 * 1024 * 1024, // 50MB
      cpuUsage: 0.5, // 50%
      networkLatency: 50, // 50ms
    },
    alertThresholds: {
      consecutiveSlowFrames: 3,
      memoryLeakDetection: true,
      highCpuUsage: 5,
    },
  } as MonitoringConfig,
};
