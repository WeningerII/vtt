/**
 * Automated optimization engine for VTT systems
 */

import { Profiler, PerformanceMetrics } from './Profiler';
import { logger } from '@vtt/logging';
import { BenchmarkRunner, SystemBenchmarkSuite} from './Benchmarks';

export interface OptimizationRule {
  name: string;
  condition: (_metrics: PerformanceMetrics[], systemState: any) => boolean;
  action: (systemState: any) => Promise<void>;
  priority: number;
  enabled: boolean;
}

export interface OptimizationConfig {
  rules: OptimizationRule[];
  thresholds: {
    criticalLatency: number;
    memoryWarning: number;
    fpsTarget: number;
    networkLatency: number;
  };
  autoOptimize: boolean;
  maxOptimizationsPerSecond: number;
}

export interface SystemState {
  renderer: {
    objectsRendered: number;
    drawCalls: number;
    fps: number;
    memoryUsage: number;
  };
  physics: {
    bodiesActive: number;
    collisionChecks: number;
    simulationTime: number;
  };
  network: {
    messagesPerSecond: number;
    latency: number;
    bandwidth: number;
  };
  ecs: {
    entitiesCount: number;
    systemsActive: number;
    updateTime: number;
  };
}

export class OptimizationEngine {
  private profiler: Profiler;
  private benchmarkRunner: BenchmarkRunner;
  private config: OptimizationConfig;
  private optimizationHistory: Array<{
    timestamp: number;
    rule: string;
    impact: number;
    success: boolean;
  }> = [];
  private lastOptimization = 0;
  private isOptimizing = false;

  constructor(profiler: Profiler, config: OptimizationConfig) {
    this.profiler = profiler;
    this.benchmarkRunner = new BenchmarkRunner(profiler);
    this.config = config;
  }

  // Automatic optimization monitoring
  startAutoOptimization(): void {
    if (!this.config.autoOptimize) return;

    setInterval(async () => {
      await this.runOptimizationCycle();
    }, 1000); // Check every second
  }

  private async runOptimizationCycle(): Promise<void> {
    if (this.isOptimizing) return;
    
    const now = Date.now();
    const timeSinceLastOptimization = now - this.lastOptimization;
    const minInterval = 1000 / this.config.maxOptimizationsPerSecond;
    
    if (timeSinceLastOptimization < minInterval) return;

    this.isOptimizing = true;
    
    try {
      const metrics = this.profiler.getProfileSummary();
      const systemState = await this.getSystemState();
      
      const applicableRules = this.config.rules
        .filter(rule => rule.enabled && rule.condition(metrics, systemState))
        .sort((a, b) => b.priority - a.priority);

      if (applicableRules.length > 0) {
        const rule = applicableRules[0];
        if (rule) {
          await this.applyOptimization(rule, systemState);
        }
      }
    } finally {
      this.isOptimizing = false;
    }
  }

  private async applyOptimization(rule: OptimizationRule, systemState: SystemState): Promise<void> {
    const startTime = Date.now();
    let success = false;
    
    try {
      await rule.action(systemState);
      success = true;
      this.lastOptimization = Date.now();
    } catch (error) {
      logger.error(`Optimization rule '${rule.name}' failed:`, error);
    }

    const impact = Date.now() - startTime;
    this.optimizationHistory.push({
      timestamp: startTime,
      rule: rule.name,
      impact,
      success
    });

    // Limit history size
    if (this.optimizationHistory.length > 1000) {
      this.optimizationHistory = this.optimizationHistory.slice(-1000);
    }
  }

  // System state monitoring
  private async getSystemState(): Promise<SystemState> {
    // This would integrate with actual VTT systems
    // For now, return simulated state
    return {
      renderer: {
        objectsRendered: Math.floor(Math.random() * 1000) + 100,
        drawCalls: Math.floor(Math.random() * 50) + 10,
        fps: Math.random() * 60 + 30,
        memoryUsage: Math.random() * 100 + 50
      },
      physics: {
        bodiesActive: Math.floor(Math.random() * 200) + 50,
        collisionChecks: Math.floor(Math.random() * 500) + 100,
        simulationTime: Math.random() * 16 + 2
      },
      network: {
        messagesPerSecond: Math.floor(Math.random() * 100) + 20,
        latency: Math.random() * 100 + 10,
        bandwidth: Math.random() * 1000 + 500
      },
      ecs: {
        entitiesCount: Math.floor(Math.random() * 500) + 100,
        systemsActive: Math.floor(Math.random() * 10) + 5,
        updateTime: Math.random() * 10 + 1
      }
    };
  }

  // Predefined optimization rules
  createDefaultOptimizationRules(): OptimizationRule[] {
    return [
      {
        name: 'Reduce Renderer Quality',
        condition: (_metrics, state: SystemState) => {
          return state.renderer.fps < this.config.thresholds.fpsTarget &&
                 state.renderer.objectsRendered > 500;
        },
        action: async (state: SystemState) => {
          // Reduce render quality, enable LOD, increase culling distance
          logger.info('Applying renderer quality reduction optimization');
          state.renderer.objectsRendered = Math.floor(state.renderer.objectsRendered * 0.8);
        },
        priority: 8,
        enabled: true
      },
      
      {
        name: 'Optimize Physics Simulation',
        condition: (_metrics, state: SystemState) => {
          return state.physics.simulationTime > 16 && // Taking more than 16ms
                 state.physics.bodiesActive > 100;
        },
        action: async (state: SystemState) => {
          // Reduce physics accuracy, increase timestep, disable sleeping bodies
          logger.info('Applying physics optimization');
          state.physics.bodiesActive = Math.floor(state.physics.bodiesActive * 0.9);
        },
        priority: 7,
        enabled: true
      },
      
      {
        name: 'Network Message Batching',
        condition: (_metrics, state: SystemState) => {
          return state.network.messagesPerSecond > 50 &&
                 state.network.latency > this.config.thresholds.networkLatency;
        },
        action: async (state: SystemState) => {
          // Enable message batching, increase batch size
          logger.info('Applying network message batching');
          state.network.messagesPerSecond = Math.floor(state.network.messagesPerSecond * 0.7);
        },
        priority: 6,
        enabled: true
      },
      
      {
        name: 'ECS System Frequency Reduction',
        condition: (_metrics, state: SystemState) => {
          return state.ecs.updateTime > 10 && // Taking more than 10ms
                 state.ecs.systemsActive > 8;
        },
        action: async (state: SystemState) => {
          // Reduce update frequency for non-critical systems
          logger.info('Applying ECS system frequency reduction');
          state.ecs.updateTime = Math.max(1, state.ecs.updateTime * 0.8);
        },
        priority: 5,
        enabled: true
      },
      
      {
        name: 'Memory Garbage Collection',
        condition: (_metrics, state: SystemState) => {
          return state.renderer.memoryUsage > this.config.thresholds.memoryWarning;
        },
        action: async (state: SystemState) => {
          // Force garbage collection, clear caches
          logger.info('Applying memory optimization');
          if (global.gc) {
            global.gc();
          }
          state.renderer.memoryUsage = Math.max(10, state.renderer.memoryUsage * 0.7);
        },
        priority: 9,
        enabled: true
      },
      
      {
        name: 'Audio Quality Reduction',
        condition: (_metrics, state: SystemState) => {
          return state.renderer.fps < this.config.thresholds.fpsTarget * 0.8; // 80% of target
        },
        action: async (_state: SystemState) => {
          // Reduce audio quality, disable spatial audio
          logger.info('Applying audio quality reduction');
        },
        priority: 3,
        enabled: true
      },
      
      {
        name: 'Animation Frame Skipping',
        condition: (_metrics, state: SystemState) => {
          return state.renderer.fps < this.config.thresholds.fpsTarget * 0.6; // 60% of target
        },
        action: async (_state: SystemState) => {
          // Skip animation frames, reduce animation quality
          logger.info('Applying animation frame skipping');
        },
        priority: 4,
        enabled: true
      }
    ];
  }

  // Performance analysis and recommendations
  async analyzePerformance(): Promise<{
    bottlenecks: Array<{ system: string; severity: number; description: string }>;
    recommendations: string[];
    optimizationOpportunities: Array<{ rule: string; expectedImpact: number }>;
  }> {
    const metrics = this.profiler.getProfileSummary();
    const systemState = await this.getSystemState();
    const bottlenecks = this.profiler.findBottlenecks();
    
    const analysis: {
      bottlenecks: Array<{ system: string; severity: number; description: string }>;
      recommendations: string[];
      optimizationOpportunities: Array<{ rule: string; expectedImpact: number }>;
    } = {
      bottlenecks: bottlenecks.map(b => ({
        system: this.categorizeBottleneck(b.name),
        severity: this.calculateSeverity(b.avgTime, b.impact),
        description: `${b.name} averaging ${b.avgTime.toFixed(2)}ms (${b.count} samples)`
      })),
      recommendations: [],
      optimizationOpportunities: []
    };

    // Generate recommendations
    if (systemState.renderer.fps < this.config.thresholds.fpsTarget) {
      analysis.recommendations.push('Frame rate below target - consider reducing render quality or object count');
    }
    
    if (systemState.physics.simulationTime > 16) {
      analysis.recommendations.push('Physics simulation taking >16ms - reduce body count or accuracy');
    }
    
    if (systemState.network.latency > this.config.thresholds.networkLatency) {
      analysis.recommendations.push('High network latency detected - enable message batching or compression');
    }

    // Find applicable optimization rules
    for (const rule of this.config.rules) {
      if (rule.enabled && rule.condition(metrics, systemState)) {
        analysis.optimizationOpportunities.push({
          rule: rule.name,
          expectedImpact: this.estimateOptimizationImpact(rule, systemState)
        });
      }
    }

    return analysis;
  }

  private categorizeBottleneck(name: string): string {
    if (name.toLowerCase().includes('render')) return 'Renderer';
    if (name.toLowerCase().includes('physics')) return 'Physics';
    if (name.toLowerCase().includes('network')) return 'Network';
    if (name.toLowerCase().includes('ecs')) return 'ECS';
    return 'System';
  }

  private calculateSeverity(averageTime: number, severity: string): number {
    const severityMap: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    return severityMap[severity] || 1;
  }

  private estimateOptimizationImpact(rule: OptimizationRule, state: SystemState): number {
    // Simple impact estimation based on rule priority and current state
    const baseImpact = rule.priority * 0.1;
    
    // Adjust based on system state
    if (rule.name.includes('Renderer') && state.renderer.fps < 30) {
      return baseImpact * 2;
    }
    if (rule.name.includes('Physics') && state.physics.simulationTime > 20) {
      return baseImpact * 1.5;
    }
    
    return baseImpact;
  }

  // Manual optimization triggers
  async optimizeRenderer(aggressiveness: number = 0.5): Promise<void> {
    const rules = this.config.rules.filter(r => r.name.includes('Render'));
    const systemState = await this.getSystemState();
    
    for (const rule of rules) {
      if (aggressiveness > 0.3 || rule.condition([], systemState)) {
        await this.applyOptimization(rule, systemState);
      }
    }
  }

  async optimizePhysics(aggressiveness: number = 0.5): Promise<void> {
    const rules = this.config.rules.filter(r => r.name.includes('Physics'));
    const systemState = await this.getSystemState();
    
    for (const rule of rules) {
      if (aggressiveness > 0.3 || rule.condition([], systemState)) {
        await this.applyOptimization(rule, systemState);
      }
    }
  }

  async optimizeNetwork(aggressiveness: number = 0.5): Promise<void> {
    const rules = this.config.rules.filter(r => r.name.includes('Network'));
    const systemState = await this.getSystemState();
    
    for (const rule of rules) {
      if (aggressiveness > 0.3 || rule.condition([], systemState)) {
        await this.applyOptimization(rule, systemState);
      }
    }
  }

  // Configuration management
  addOptimizationRule(rule: OptimizationRule): void {
    this.config.rules.push(rule);
  }

  removeOptimizationRule(name: string): boolean {
    const index = this.config.rules.findIndex(r => r.name === name);
    if (index !== -1) {
      this.config.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  updateThresholds(thresholds: Partial<OptimizationConfig['thresholds']>): void {
    this.config.thresholds = { ...this.config.thresholds, ...thresholds };
  }

  // Reporting and analytics
  getOptimizationHistory(timeWindowMs?: number): typeof this.optimizationHistory {
    if (!timeWindowMs) return [...this.optimizationHistory];
    
    const cutoff = Date.now() - timeWindowMs;
    return this.optimizationHistory.filter(h => h.timestamp >= cutoff);
  }

  getOptimizationStats(): {
    totalOptimizations: number;
    successRate: number;
    averageImpact: number;
    mostUsedRules: Array<{ rule: string; count: number }>;
  } {
    const total = this.optimizationHistory.length;
    const successful = this.optimizationHistory.filter(h => h.success).length;
    const averageImpact = this.optimizationHistory.reduce((sum, h) => sum + h.impact, 0) / total || 0;
    
    const ruleCounts = new Map<string, number>();
    for (const history of this.optimizationHistory) {
      ruleCounts.set(history.rule, (ruleCounts.get(history.rule) || 0) + 1);
    }
    
    const mostUsedRules = Array.from(ruleCounts.entries())
      .map(([rule, count]) => ({ rule, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalOptimizations: total,
      successRate: successful / total || 0,
      averageImpact,
      mostUsedRules
    };
  }

  // Cleanup
  dispose(): void {
    this.optimizationHistory = [];
  }
}
