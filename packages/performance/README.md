# @vtt/performance

Performance monitoring and optimization toolkit for VTT applications.

## Installation

```bash
pnpm add @vtt/performance
```

## Features

- **Benchmarking**: Comprehensive benchmarking suite for game operations
- **Profiling**: Real-time performance profiling with bottleneck detection
- **Caching**: Intelligent cache management with TTL and memory limits
- **Optimization**: Automated performance optimization engine

## Usage

### Benchmarking

```typescript
import { Benchmarks } from '@vtt/performance';

const benchmarks = new Benchmarks();

// Run all benchmarks
const results = await benchmarks.runAll();

// Run specific benchmark
const renderResults = await benchmarks.runRenderingBenchmark();

// Compare with baseline
const comparison = benchmarks.compareWithBaseline(results, baseline);
```

### Profiling

```typescript
import { Profiler } from '@vtt/performance';

const profiler = new Profiler();

// Start profiling
profiler.startProfiling('operation-name');

// Your code here
await someExpensiveOperation();

// End profiling
const metrics = profiler.endProfiling('operation-name');

// Find bottlenecks
const bottlenecks = profiler.findBottlenecks();

// Get performance report
const report = profiler.generateReport();
```

### Cache Management

```typescript
import { CacheManager } from '@vtt/performance';

const cache = new CacheManager({
  maxSize: 100 * 1024 * 1024, // 100MB
  ttl: 3600000, // 1 hour
  cleanupInterval: 300000, // 5 minutes
});

// Set cache entry
await cache.set('key', data, { ttl: 600000 });

// Get cache entry
const data = await cache.get('key');

// Invalidate cache
cache.invalidate('key');

// Get cache stats
const stats = cache.getStats();
```

### Optimization Engine

```typescript
import { OptimizationEngine } from '@vtt/performance';

const optimizer = new OptimizationEngine();

// Analyze performance
const analysis = await optimizer.analyzePerformance();

// Get optimization suggestions
const suggestions = optimizer.suggestOptimizations(analysis);

// Apply optimizations
await optimizer.applyOptimizations(suggestions);
```

## API Reference

### Benchmarks

- `runAll()`: Run all benchmark suites
- `runRenderingBenchmark()`: Test rendering performance
- `runPhysicsBenchmark()`: Test physics calculations
- `runNetworkBenchmark()`: Test network operations
- `runAIBenchmark()`: Test AI computations
- `compareWithBaseline()`: Compare results with baseline

### Profiler

- `startProfiling(name)`: Start profiling an operation
- `endProfiling(name)`: End profiling and get metrics
- `mark(name)`: Create a performance mark
- `measure(name, startMark, endMark)`: Measure between marks
- `findBottlenecks()`: Identify performance bottlenecks
- `generateReport()`: Generate comprehensive report

### CacheManager

- `set(key, value, options)`: Store value in cache
- `get(key)`: Retrieve value from cache
- `has(key)`: Check if key exists
- `delete(key)`: Remove entry from cache
- `clear()`: Clear all cache entries
- `getStats()`: Get cache statistics

### OptimizationEngine

- `analyzePerformance()`: Analyze current performance
- `suggestOptimizations()`: Get optimization suggestions
- `applyOptimizations()`: Apply suggested optimizations
- `monitorPerformance()`: Start performance monitoring

## Configuration

```typescript
// Performance configuration
export interface PerformanceConfig {
  // Profiling
  enableProfiling: boolean;
  profilingInterval: number;
  
  // Caching
  cacheEnabled: boolean;
  cacheMaxSize: number;
  cacheTTL: number;
  
  // Optimization
  autoOptimize: boolean;
  optimizationThreshold: number;
  
  // Monitoring
  enableMonitoring: boolean;
  metricsInterval: number;
}
```

## Best Practices

1. **Profile Before Optimizing**: Always profile to identify actual bottlenecks
2. **Cache Strategically**: Cache expensive computations and frequent lookups
3. **Monitor Continuously**: Use monitoring to catch performance regressions
4. **Benchmark Regularly**: Run benchmarks as part of CI/CD pipeline
5. **Optimize Incrementally**: Apply optimizations one at a time and measure impact

## License

MIT
