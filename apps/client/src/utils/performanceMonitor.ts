/**
 * Lightweight Performance Monitor for Gaming Metrics
 * Tracks key gaming performance indicators without heavy overhead
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  category: 'dice' | 'combat' | 'character' | 'map' | 'chat' | 'general';
}

interface GamePerformanceData {
  frameRate: number[];
  diceRollLatency: number[];
  characterSheetLoad: number[];
  mapRenderTime: number[];
  chatMessageLatency: number[];
  memoryUsage: number[];
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private isEnabled: boolean = true;
  private maxMetrics: number = 1000; // Limit to prevent memory bloat
  private observers: Map<string, PerformanceObserver> = new Map();

  constructor() {
    this.initializeObservers();
  }

  /**
   * Initialize lightweight performance observers
   */
  private initializeObservers() {
    // Only initialize if PerformanceObserver is supported
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      // Monitor paint and navigation timing
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric({
            name: entry.name,
            value: entry.startTime,
            category: 'general'
          });
        }
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.set('paint', paintObserver);

      // Monitor user interactions
      const measureObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric({
            name: entry.name,
            value: entry.duration,
            category: 'general'
          });
        }
      });
      measureObserver.observe({ entryTypes: ['measure'] });
      this.observers.set('measure', measureObserver);

    } catch (error) {
      console.warn('Performance monitoring partially unavailable:', error);
    }
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>) {
    if (!this.isEnabled) return;

    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: performance.now()
    };

    this.metrics.push(fullMetric);

    // Keep metrics array from growing too large
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.splice(0, this.metrics.length - this.maxMetrics);
    }
  }

  /**
   * Gaming-specific performance tracking
   */
  
  // Track dice roll performance
  startDiceRoll(): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric({
        name: 'dice-roll-duration',
        value: duration,
        category: 'dice'
      });
    };
  }

  // Track character sheet loading
  startCharacterLoad(): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric({
        name: 'character-sheet-load',
        value: duration,
        category: 'character'
      });
    };
  }

  // Track combat action performance
  startCombatAction(action: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric({
        name: `combat-${action}`,
        value: duration,
        category: 'combat'
      });
    };
  }

  // Track map rendering
  startMapRender(): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric({
        name: 'map-render-time',
        value: duration,
        category: 'map'
      });
    };
  }

  // Track chat message sending
  startChatMessage(): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric({
        name: 'chat-message-latency',
        value: duration,
        category: 'chat'
      });
    };
  }

  /**
   * Get performance summary with lightweight calculations
   */
  getSummary(): GamePerformanceData {
    const summary: GamePerformanceData = {
      frameRate: [],
      diceRollLatency: [],
      characterSheetLoad: [],
      mapRenderTime: [],
      chatMessageLatency: [],
      memoryUsage: []
    };

    // Group metrics by category
    const diceMetrics = this.metrics.filter(m => m.category === 'dice');
    const characterMetrics = this.metrics.filter(m => m.category === 'character');
    const mapMetrics = this.metrics.filter(m => m.category === 'map');
    const chatMetrics = this.metrics.filter(m => m.category === 'chat');

    // Extract values (keep only recent metrics to avoid computation overhead)
    summary.diceRollLatency = diceMetrics.slice(-50).map(m => m.value);
    summary.characterSheetLoad = characterMetrics.slice(-20).map(m => m.value);
    summary.mapRenderTime = mapMetrics.slice(-30).map(m => m.value);
    summary.chatMessageLatency = chatMetrics.slice(-100).map(m => m.value);

    // Add memory usage if available
    if ('memory' in performance) {
      const mem = (performance as any).memory;
      summary.memoryUsage.push(mem.usedJSHeapSize / 1024 / 1024); // MB
    }

    return summary;
  }

  /**
   * Get simple performance stats
   */
  getStats() {
    const summary = this.getSummary();
    
    const average = (arr: number[]) => 
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    return {
      avgDiceRollTime: Math.round(average(summary.diceRollLatency)),
      avgCharacterLoadTime: Math.round(average(summary.characterSheetLoad)),
      avgMapRenderTime: Math.round(average(summary.mapRenderTime)),
      avgChatLatency: Math.round(average(summary.chatMessageLatency)),
      currentMemoryUsage: summary.memoryUsage[summary.memoryUsage.length - 1] || 0,
      totalMetrics: this.metrics.length
    };
  }

  /**
   * Check for performance issues
   */
  getHealthStatus() {
    const stats = this.getStats();
    const issues: string[] = [];

    if (stats.avgDiceRollTime > 100) {
      issues.push('Slow dice roll performance');
    }
    if (stats.avgCharacterLoadTime > 1000) {
      issues.push('Slow character sheet loading');
    }
    if (stats.avgMapRenderTime > 500) {
      issues.push('Slow map rendering');
    }
    if (stats.currentMemoryUsage > 100) {
      issues.push('High memory usage');
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      stats
    };
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = [];
  }

  /**
   * Cleanup observers
   */
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.metrics = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * React hook for performance monitoring
 */
export function usePerformanceMonitor() {
  return {
    startDiceRoll: performanceMonitor.startDiceRoll.bind(performanceMonitor),
    startCharacterLoad: performanceMonitor.startCharacterLoad.bind(performanceMonitor),
    startCombatAction: performanceMonitor.startCombatAction.bind(performanceMonitor),
    startMapRender: performanceMonitor.startMapRender.bind(performanceMonitor),
    startChatMessage: performanceMonitor.startChatMessage.bind(performanceMonitor),
    getStats: performanceMonitor.getStats.bind(performanceMonitor),
    getHealthStatus: performanceMonitor.getHealthStatus.bind(performanceMonitor)
  };
}
