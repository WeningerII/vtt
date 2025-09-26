/**
 * VTT Performance Monitoring and Core Web Vitals Tracking
 * Enhanced with comprehensive performance monitoring for the VTT application
 */

import { createElement, useEffect, useRef, useState, type ComponentType } from "react";
import { logger } from "../lib/logger";

interface PerformanceMemory {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
}

type PerformanceWithMemory = Performance & { memory?: PerformanceMemory };

const getPerformanceMemory = (): PerformanceMemory | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  return (window.performance as PerformanceWithMemory).memory;
};

const serializeProps = (value: unknown): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    logger.warn("Failed to serialize component props for performance metric", error);
    return undefined;
  }
};

// Performance metrics interface
interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
  memoryUsage?: number;
  propsSnapshot?: string;
}

// Global performance store
class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private observers: ((metrics: PerformanceMetrics) => void)[] = [];
  private memoryCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.startMemoryMonitoring();
  }

  addMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    this.observers.forEach((observer) => observer(metric));

    // Keep only last 1000 metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  getMetrics(componentName?: string): PerformanceMetrics[] {
    if (componentName) {
      return this.metrics.filter((m) => m.componentName === componentName);
    }
    return [...this.metrics];
  }

  getAverageRenderTime(componentName: string): number {
    const componentMetrics = this.getMetrics(componentName);
    if (componentMetrics.length === 0) {
      return 0;
    }

    const totalTime = componentMetrics.reduce((sum, metric) => sum + metric.renderTime, 0);
    return totalTime / componentMetrics.length;
  }

  subscribe(observer: (metrics: PerformanceMetrics) => void) {
    this.observers.push(observer);
    return () => {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  private startMemoryMonitoring() {
    if (
      typeof window !== "undefined" &&
      "performance" in window &&
      Boolean(getPerformanceMemory())
    ) {
      this.memoryCheckInterval = setInterval(() => {
        const memory = getPerformanceMemory();
        if (memory && memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.9) {
          console.warn("Memory usage is high:", {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
          });
        }
      }, 10000); // Check every 10 seconds
    }
  }

  destroy() {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    this.observers = [];
    this.metrics = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

// React hook for measuring component render performance
export function useRenderPerformance<P>(componentName: string, props?: P) {
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
    renderCount.current++;
  });

  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;

    const propsSnapshot = serializeProps(props);
    const memoryUsage = getPerformanceMemory()?.usedJSHeapSize;

    const metric: PerformanceMetrics = {
      renderTime,
      componentName,
      timestamp: Date.now(),
      ...(propsSnapshot !== undefined ? { propsSnapshot } : {}),
      ...(memoryUsage !== undefined ? { memoryUsage } : {}),
    };

    performanceMonitor.addMetric(metric);

    // Log slow renders in development
    if (process.env.NODE_ENV === "development" && renderTime > 16) {
      console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
    }
  });

  return {
    renderCount: renderCount.current,
    averageRenderTime: performanceMonitor.getAverageRenderTime(componentName),
  };
}

// Hook for detecting memory leaks
export function useMemoryLeak(_componentName: string) {
  const [memoryUsage, setMemoryUsage] = useState<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "performance" in window &&
      Boolean(getPerformanceMemory())
    ) {
      intervalRef.current = setInterval(() => {
        const memory = getPerformanceMemory();
        if (memory) {
          setMemoryUsage(memory.usedJSHeapSize);
        }
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, []);

  return { memoryUsage };
}

// Higher-order component for performance monitoring
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: ComponentType<P>,
  componentName?: string,
) {
  const displayName =
    componentName || WrappedComponent.displayName || WrappedComponent.name || "Component";

  const PerformanceWrappedComponent = (props: P) => {
    useRenderPerformance(displayName, props);
    return createElement(WrappedComponent, props);
  };

  PerformanceWrappedComponent.displayName = `withPerformanceMonitoring(${displayName})`;
  return PerformanceWrappedComponent;
}

// Utility for measuring async operations
export function measureAsync<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
  const startTime = performance.now();

  return operation().finally(() => {
    const duration = performance.now() - startTime;
    logger.debug(`${operationName} took ${duration.toFixed(2)}ms`);

    if (duration > 1000) {
      logger.warn(`Slow async operation: ${operationName} took ${duration.toFixed(2)}ms`);
    }
  });
}

// Bundle size analyzer utility
export function analyzeBundleSize() {
  if (typeof window !== "undefined" && "performance" in window) {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];

    const jsResources = resources.filter(
      (resource) => resource.name.includes(".js") && !resource.name.includes("node_modules"),
    );

    const totalJSSize = jsResources.reduce((total, resource) => {
      return total + (resource.transferSize || 0);
    }, 0);

    logger.debug("Bundle Analysis:", {
      totalJSSize: `${(totalJSSize / 1024).toFixed(2)} KB`,
      jsFiles: jsResources.length,
      loadTime: `${navigation.loadEventEnd - navigation.loadEventStart}ms`,
      resources: jsResources.map((r) => ({
        name: r.name.split("/").pop(),
        size: `${((r.transferSize || 0) / 1024).toFixed(2)} KB`,
        loadTime: `${(r.responseEnd - r.requestStart).toFixed(2)}ms`,
      })),
    });
  }
}

// Performance dashboard component
export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);

  useEffect(() => {
    const unsubscribe = performanceMonitor.subscribe((metric) => {
      setMetrics((prev) => [...prev.slice(-99), metric]); // Keep last 100 metrics
    });

    return unsubscribe;
  }, []);

  const componentStats = metrics.reduce(
    (stats, metric) => {
      if (!stats[metric.componentName]) {
        stats[metric.componentName] = {
          count: 0,
          totalTime: 0,
          maxTime: 0,
          minTime: Infinity,
        };
      }

      const stat = stats[metric.componentName];
      if (stat) {
        stat.count++;
      }
      if (stat) {
        stat.totalTime += metric.renderTime;
      }
      if (stat) {
        stat.maxTime = Math.max(stat.maxTime, metric.renderTime);
      }
      if (stat) {
        stat.minTime = Math.min(stat.minTime, metric.renderTime);
      }

      return stats;
    },
    {} as Record<string, { count: number; totalTime: number; maxTime: number; minTime: number }>,
  );

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return createElement(
    "div",
    {
      style: {
        position: "fixed",
        top: 10,
        right: 10,
        background: "rgba(0,0,0,0.8)",
        color: "white",
        padding: 10,
        fontSize: 12,
        maxWidth: 300,
        maxHeight: 400,
        overflow: "auto",
        zIndex: 9999,
      },
    },
    createElement("h3", null, "Performance Monitor"),
    ...Object.entries(componentStats).map(([name, stats]) =>
      createElement(
        "div",
        { key: name, style: { marginBottom: 8 } },
        createElement("strong", null, name),
        createElement("div", null, `Renders: ${stats.count}`),
        createElement("div", null, `Avg: ${(stats.totalTime / stats.count).toFixed(2)}ms`),
        createElement("div", null, `Max: ${stats.maxTime.toFixed(2)}ms`),
      ),
    ),
  );
}
