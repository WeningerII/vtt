/**
 * Memory Profiler for monitoring and analyzing memory usage
 */

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
}

interface MemoryLeak {
  component: string;
  severity: 'low' | 'medium' | 'high';
  growth: number;
  samples: number[];
}

export class MemoryProfiler {
  private snapshots: MemorySnapshot[] = [];
  private leaks: Map<string, MemoryLeak> = new Map();
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly maxSnapshots = 100;

  /**
   * Start memory monitoring
   */
  startMonitoring(intervalMs = 5000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.takeSnapshot();
    }, intervalMs);
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Take a memory snapshot
   */
  takeSnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      rss: memUsage.rss
    };

    this.snapshots.push(snapshot);

    // Keep only recent snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    // Check for potential leaks
    this.detectLeaks();

    return snapshot;
  }

  /**
   * Detect potential memory leaks
   */
  private detectLeaks(): void {
    if (this.snapshots.length < 10) return;

    const recentSnapshots = this.snapshots.slice(-10);
    const avgGrowth = this.calculateAverageGrowth(recentSnapshots);

    // Threshold for leak detection (5MB per minute)
    const leakThreshold = 5 * 1024 * 1024;

    if (avgGrowth > leakThreshold) {
      const severity = avgGrowth > leakThreshold * 3 ? 'high' : 
                      avgGrowth > leakThreshold * 2 ? 'medium' : 'low';
      
      this.reportLeak('heap', severity, avgGrowth);
    }
  }

  /**
   * Calculate average memory growth
   */
  private calculateAverageGrowth(snapshots: MemorySnapshot[]): number {
    if (snapshots.length < 2) return 0;

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    
    if (!first || !last) return 0;
    
    const timeDiff = (last.timestamp - first.timestamp) / 1000; // seconds

    if (timeDiff === 0) return 0;

    const memoryDiff = last.heapUsed - first.heapUsed;
    return (memoryDiff / timeDiff) * 60; // bytes per minute
  }

  /**
   * Report a potential memory leak
   */
  private reportLeak(component: string, severity: MemoryLeak['severity'], growth: number): void {
    const existing = this.leaks.get(component);
    
    if (existing) {
      existing.severity = severity;
      existing.growth = growth;
      existing.samples.push(Date.now());
    } else {
      this.leaks.set(component, {
        component,
        severity,
        growth,
        samples: [Date.now()]
      });
    }

    console.warn(`[MemoryProfiler] Potential memory leak detected in ${component}:`, {
      severity,
      growthRate: `${(growth / 1024 / 1024).toFixed(2)} MB/min`
    });
  }

  /**
   * Get memory statistics
   */
  getStatistics(): {
    current: MemorySnapshot | null;
    average: Partial<MemorySnapshot>;
    peak: Partial<MemorySnapshot>;
    leaks: MemoryLeak[];
  } {
    const current = this.snapshots[this.snapshots.length - 1] || null;
    
    const average: Partial<MemorySnapshot> = {};
    const peak: Partial<MemorySnapshot> = {};

    if (this.snapshots.length > 0) {
      const sum = this.snapshots.reduce((acc, snap) => ({
        heapUsed: acc.heapUsed + snap.heapUsed,
        heapTotal: acc.heapTotal + snap.heapTotal,
        external: acc.external + snap.external,
        arrayBuffers: acc.arrayBuffers + snap.arrayBuffers,
        rss: acc.rss + snap.rss
      }), {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        arrayBuffers: 0,
        rss: 0
      });

      const count = this.snapshots.length;
      average.heapUsed = sum.heapUsed / count;
      average.heapTotal = sum.heapTotal / count;
      average.external = sum.external / count;
      average.arrayBuffers = sum.arrayBuffers / count;
      average.rss = sum.rss / count;

      peak.heapUsed = Math.max(...this.snapshots.map(s => s.heapUsed));
      peak.heapTotal = Math.max(...this.snapshots.map(s => s.heapTotal));
      peak.external = Math.max(...this.snapshots.map(s => s.external));
      peak.arrayBuffers = Math.max(...this.snapshots.map(s => s.arrayBuffers));
      peak.rss = Math.max(...this.snapshots.map(s => s.rss));
    }

    return {
      current,
      average,
      peak,
      leaks: Array.from(this.leaks.values())
    };
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC(): void {
    if (global.gc) {
      global.gc();
      console.log('[MemoryProfiler] Garbage collection triggered');
    } else {
      console.warn('[MemoryProfiler] Garbage collection not available. Run with --expose-gc flag');
    }
  }

  /**
   * Generate memory report
   */
  generateReport(): string {
    const stats = this.getStatistics();
    const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

    let report = '=== Memory Profile Report ===\n\n';

    if (stats.current) {
      report += 'Current Memory Usage:\n';
      report += `  Heap Used: ${formatBytes(stats.current.heapUsed)}\n`;
      report += `  Heap Total: ${formatBytes(stats.current.heapTotal)}\n`;
      report += `  External: ${formatBytes(stats.current.external)}\n`;
      report += `  RSS: ${formatBytes(stats.current.rss)}\n\n`;
    }

    report += 'Average Memory Usage:\n';
    report += `  Heap Used: ${formatBytes(stats.average.heapUsed || 0)}\n`;
    report += `  Heap Total: ${formatBytes(stats.average.heapTotal || 0)}\n\n`;

    report += 'Peak Memory Usage:\n';
    report += `  Heap Used: ${formatBytes(stats.peak.heapUsed || 0)}\n`;
    report += `  Heap Total: ${formatBytes(stats.peak.heapTotal || 0)}\n\n`;

    if (stats.leaks.length > 0) {
      report += 'Potential Memory Leaks:\n';
      stats.leaks.forEach(leak => {
        report += `  - ${leak.component}: ${leak.severity} severity, ${formatBytes(leak.growth)}/min\n`;
      });
    } else {
      report += 'No memory leaks detected\n';
    }

    return report;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.snapshots = [];
    this.leaks.clear();
  }
}

// Singleton instance
export const memoryProfiler = new MemoryProfiler();

/**
 * React hook for memory monitoring
 */
export function useMemoryMonitor(enabled = true) {
  // Import React hooks at the top of the file if using this hook
  // const [memoryStats, setMemoryStats] = useState<ReturnType<typeof memoryProfiler.getStatistics> | null>(null);
  
  // Placeholder implementation - uncomment and add React import to use
  const memoryStats: ReturnType<typeof memoryProfiler.getStatistics> | null = null;
  const setMemoryStats = (stats: any) => {};

  // useEffect implementation - uncomment and add React import to use
  /*
  useEffect(() => {
    if (!enabled) return;

    memoryProfiler.startMonitoring();
    
    const interval = setInterval(() => {
      setMemoryStats(memoryProfiler.getStatistics());
    }, 5000);

    return () => {
      clearInterval(interval);
      memoryProfiler.stopMonitoring();
    };
  }, [enabled]);
  */
  
  // For now, just start monitoring if enabled
  if (enabled && typeof process !== 'undefined') {
    memoryProfiler.startMonitoring();
  }

  return memoryStats;
}

/**
 * Memory monitoring middleware for Express
 */
export function memoryMonitoringMiddleware() {
  return (req: any, res: any, next: any) => {
    const startMemory = process.memoryUsage().heapUsed;
    
    res.on('finish', () => {
      const endMemory = process.memoryUsage().heapUsed;
      const memoryDiff = endMemory - startMemory;
      
      if (memoryDiff > 10 * 1024 * 1024) { // 10MB threshold
        console.warn(`[MemoryProfiler] High memory usage for ${req.method} ${req.path}: ${(memoryDiff / 1024 / 1024).toFixed(2)} MB`);
      }
    });
    
    next();
  };
}
