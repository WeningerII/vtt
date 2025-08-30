/**
 * Performance optimization package for VTT
 */

export * from './LazyLoader';
// export * from './PerformanceOptimizer'; // Module doesn't exist yet
// export * from './metrics'; // Module doesn't exist yet
// export * from './CodeSplitter'; // Module doesn't exist yet
// export * from './ReactOptimizer'; // Module doesn't exist yet
export * from './MemoryProfiler';
export * from './PerformanceBudget';
export * from './LazyLoader';
export * from './PerformanceMonitor';

import { Profiler } from './Profiler';
import { BenchmarkRunner } from './Benchmarks';
import { OptimizationEngine, OptimizationConfig } from './OptimizationEngine';

// Convenience factory for production setup
export function createPerformanceManager(_config?: Partial<OptimizationConfig>) {
  const profiler = new Profiler();
  
  const defaultConfig: OptimizationConfig = {
    rules: [],
    thresholds: {
      criticalLatency: 100, // 100ms
      memoryWarning: 80, // 80% memory usage
      fpsTarget: 60,
      networkLatency: 50 // 50ms
    },
    autoOptimize: true,
    maxOptimizationsPerSecond: 2
  };

  const optimizationEngine = new OptimizationEngine(profiler, {
    ...defaultConfig,
    ..._config
  });

  // Add default optimization rules
  const defaultRules = optimizationEngine.createDefaultOptimizationRules();
  defaultRules.forEach(rule => optimizationEngine.addOptimizationRule(rule));

  return {
    profiler,
    optimizationEngine,
    benchmarkRunner: new BenchmarkRunner(profiler),
    
    // Convenience methods
    startProfiling: () => {
      optimizationEngine.startAutoOptimization();
      return {
        profile: profiler.profile.bind(profiler),
        profileAsync: profiler.profileAsync.bind(profiler),
        // measure: profiler.measure.bind(profiler), // Removed - method doesn't exist
        measureAsync: profiler.measureAsyncFunction.bind(profiler)
      };
    },
    
    getReport: () => profiler.generateReport(),
    analyzePerformance: () => optimizationEngine.analyzePerformance(),
    
    dispose: () => {
      profiler.dispose();
      optimizationEngine.dispose();
    }
  };
}

// Performance monitoring decorators
export function ProfileMethod(_name?: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const profileName = _name || `${target.constructor.name}.${propertyKey}`;
    
    descriptor.value = function(...args: any[]) {
      const profiler = new Profiler();
      return profiler.profile(profileName, () => originalMethod.apply(this, args));
    };
    
    return descriptor;
  };
}

export function BenchmarkMethod(_iterations: number = 1000) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    // Add benchmark method
    target[`benchmark_${propertyKey}`] = function() {
      const profiler = new Profiler();
      const benchmarkRunner = new BenchmarkRunner(profiler);
      return benchmarkRunner.runBenchmark(
        `${target.constructor.name}.${propertyKey}`,
        originalMethod.bind(this),
        { iterations: _iterations }
      );
    };
    
    return descriptor;
  };
}

// Performance utilities
export class PerformanceUtils {
  static createObjectPool<T>(
    _factory: () => T,
    reset: (_obj: T) => void,
    initialSize: number = 10
  ) {
    const pool: T[] = [];
    
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      pool.push(_factory());
    }
    
    return {
      acquire(): T {
        return pool.pop() || _factory();
      },
      
      release(obj: T): void {
        reset(obj);
        if (pool.length < initialSize * 2) {
          pool.push(obj);
        }
      },
      
      size(): number {
        return pool.length;
      }
    };
  }
  
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate?: boolean
  ): T {
    let timeout: NodeJS.Timeout | null = null;
    
    return ((...args: any[]) => {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      
      const callNow = immediate && !timeout;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func(...args);
    }) as T;
  }
  
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): T {
    let inThrottle = false;
    
    return ((...args: any[]) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }) as T;
  }
  
  static memoize<T extends (...args: any[]) => any>(
    _func: T,
    _keyGenerator?: (...args: any[]) => string
  ): T {
    const cache = new Map<string, any>();
    
    return ((...args: any[]) => {
      const key = _keyGenerator ? _keyGenerator(...args) : JSON.stringify(args);
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = _func(...args);
      cache.set(key, result);
      return result;
    }) as T;
  }
}

// Export default performance manager instance
export const _defaultPerformanceManager = createPerformanceManager();
