/**
 * Performance Budget Configuration and Monitoring
 */

export interface PerformanceBudget {
  // Bundle sizes (in KB)
  bundles: {
    main: number;
    vendor: number;
    total: number;
    perRoute?: Record<string, number>;
  };
  
  // Loading metrics (in ms)
  metrics: {
    fcp: number;  // First Contentful Paint
    lcp: number;  // Largest Contentful Paint
    fid: number;  // First Input Delay
    cls: number;  // Cumulative Layout Shift
    ttfb: number; // Time to First Byte
    tti: number;  // Time to Interactive
  };
  
  // Resource counts
  resources: {
    images: number;
    scripts: number;
    stylesheets: number;
    fonts: number;
    totalRequests: number;
  };
  
  // Memory limits (in MB)
  memory: {
    initial: number;
    peak: number;
    idle: number;
  };
}

// Default performance budgets
export const DEFAULT_BUDGETS: PerformanceBudget = {
  bundles: {
    main: 200,      // 200KB for main bundle
    vendor: 300,    // 300KB for vendor bundle
    total: 600,     // 600KB total
    perRoute: {
      '/': 150,
      '/dashboard': 200,
      '/game-session': 250,
      '/character-editor': 180,
      '/campaign-browser': 160,
      '/settings': 100
    }
  },
  metrics: {
    fcp: 1800,      // 1.8s
    lcp: 2500,      // 2.5s
    fid: 100,       // 100ms
    cls: 0.1,       // 0.1
    ttfb: 600,      // 600ms
    tti: 3800       // 3.8s
  },
  resources: {
    images: 20,
    scripts: 10,
    stylesheets: 5,
    fonts: 3,
    totalRequests: 50
  },
  memory: {
    initial: 50,    // 50MB
    peak: 150,      // 150MB
    idle: 80        // 80MB
  }
};

export interface PerformanceMetrics {
  bundles?: {
    main?: number;
    vendor?: number;
    total?: number;
    perRoute?: Record<string, number>;
  };
  metrics?: {
    fcp?: number;
    lcp?: number;
    fid?: number;
    cls?: number;
    ttfb?: number;
    tti?: number;
  };
  resources?: {
    images?: number;
    scripts?: number;
    stylesheets?: number;
    fonts?: number;
    totalRequests?: number;
  };
  memory?: {
    initial?: number;
    peak?: number;
    idle?: number;
  };
}

export interface BudgetViolation {
  category: keyof PerformanceBudget;
  metric: string;
  budget: number;
  actual: number;
  severity: 'warning' | 'error';
}

export class PerformanceBudgetMonitor {
  private budget: PerformanceBudget;
  private violations: BudgetViolation[] = [];

  constructor(budget: PerformanceBudget = DEFAULT_BUDGETS) {
    this.budget = budget;
  }

  /**
   * Check metrics against budget
   */
  checkBudget(metrics: PerformanceMetrics): BudgetViolation[] {
    this.violations = [];

    // Check bundle sizes
    if (metrics.bundles) {
      this.checkBundleSizes(metrics.bundles);
    }

    // Check performance metrics
    if (metrics.metrics) {
      this.checkPerformanceMetrics(metrics.metrics);
    }

    // Check resource counts
    if (metrics.resources) {
      this.checkResourceCounts(metrics.resources);
    }

    // Check memory usage
    if (metrics.memory) {
      this.checkMemoryUsage(metrics.memory);
    }

    return this.violations;
  }

  private checkBundleSizes(bundles: PerformanceMetrics['bundles']): void {
    if (bundles?.main && bundles.main > this.budget.bundles.main) {
      this.addViolation('bundles', 'main', this.budget.bundles.main, bundles.main);
    }

    if (bundles?.vendor && bundles.vendor > this.budget.bundles.vendor) {
      this.addViolation('bundles', 'vendor', this.budget.bundles.vendor, bundles.vendor);
    }

    if (bundles?.total && bundles.total > this.budget.bundles.total) {
      this.addViolation('bundles', 'total', this.budget.bundles.total, bundles.total);
    }

    // Check per-route budgets
    if (bundles?.perRoute && this.budget.bundles.perRoute) {
      for (const [route, size] of Object.entries(bundles.perRoute)) {
        const budget = this.budget.bundles.perRoute[route];
        if (budget && size > budget) {
          this.addViolation('bundles', `route:${route}`, budget, size);
        }
      }
    }
  }

  private checkPerformanceMetrics(metrics: PerformanceMetrics['metrics']): void {
    const checks: Array<[keyof NonNullable<PerformanceMetrics['metrics']>, number]> = [
      ['fcp', this.budget.metrics.fcp],
      ['lcp', this.budget.metrics.lcp],
      ['fid', this.budget.metrics.fid],
      ['cls', this.budget.metrics.cls],
      ['ttfb', this.budget.metrics.ttfb],
      ['tti', this.budget.metrics.tti]
    ];

    for (const [metric, budget] of checks) {
      const actual = metrics?.[metric];
      if (actual !== undefined && actual > budget) {
        this.addViolation('metrics', metric, budget, actual);
      }
    }
  }

  private checkResourceCounts(resources: PerformanceMetrics['resources']): void {
    const checks: Array<[keyof NonNullable<PerformanceMetrics['resources']>, number]> = [
      ['images', this.budget.resources.images],
      ['scripts', this.budget.resources.scripts],
      ['stylesheets', this.budget.resources.stylesheets],
      ['fonts', this.budget.resources.fonts],
      ['totalRequests', this.budget.resources.totalRequests]
    ];

    for (const [resource, budget] of checks) {
      const actual = resources?.[resource];
      if (actual !== undefined && actual > budget) {
        this.addViolation('resources', resource, budget, actual);
      }
    }
  }

  private checkMemoryUsage(memory: PerformanceMetrics['memory']): void {
    const checks: Array<[keyof NonNullable<PerformanceMetrics['memory']>, number]> = [
      ['initial', this.budget.memory.initial],
      ['peak', this.budget.memory.peak],
      ['idle', this.budget.memory.idle]
    ];

    for (const [metric, budget] of checks) {
      const actual = memory?.[metric];
      if (actual !== undefined && actual > budget) {
        this.addViolation('memory', metric, budget, actual);
      }
    }
  }

  private addViolation(
    category: keyof PerformanceBudget,
    metric: string,
    budget: number,
    actual: number
  ): void {
    const percentOver = ((actual - budget) / budget) * 100;
    const severity = percentOver > 50 ? 'error' : 'warning';

    this.violations.push({
      category,
      metric,
      budget,
      actual,
      severity
    });
  }

  /**
   * Generate budget report
   */
  generateReport(metrics: PerformanceMetrics): string {
    const violations = this.checkBudget(metrics);
    let report = '=== Performance Budget Report ===\n\n';

    if (violations.length === 0) {
      report += '✅ All performance budgets met!\n';
    } else {
      report += `⚠️ Found ${violations.length} budget violations:\n\n`;
      
      const errors = violations.filter(v => v.severity === 'error');
      const warnings = violations.filter(v => v.severity === 'warning');

      if (errors.length > 0) {
        report += '❌ Errors:\n';
        errors.forEach(v => {
          const percentOver = ((v.actual - v.budget) / v.budget * 100).toFixed(1);
          report += `  - ${v.category}.${v.metric}: ${v.actual} (budget: ${v.budget}, +${percentOver}%)\n`;
        });
        report += '\n';
      }

      if (warnings.length > 0) {
        report += '⚠️ Warnings:\n';
        warnings.forEach(v => {
          const percentOver = ((v.actual - v.budget) / v.budget * 100).toFixed(1);
          report += `  - ${v.category}.${v.metric}: ${v.actual} (budget: ${v.budget}, +${percentOver}%)\n`;
        });
      }
    }

    return report;
  }

  /**
   * Update budget
   */
  updateBudget(newBudget: Partial<PerformanceBudget>): void {
    this.budget = { ...this.budget, ...newBudget };
  }

  /**
   * Get current budget
   */
  getBudget(): PerformanceBudget {
    return { ...this.budget };
  }

  /**
   * Get violations
   */
  getViolations(): BudgetViolation[] {
    return [...this.violations];
  }
}

/**
 * Webpack plugin for performance budget checking
 */
export class PerformanceBudgetPlugin {
  private monitor: PerformanceBudgetMonitor;

  constructor(budget?: PerformanceBudget) {
    this.monitor = new PerformanceBudgetMonitor(budget);
  }

  apply(compiler: any): void {
    compiler.hooks.done.tap('PerformanceBudgetPlugin', (stats: any) => {
      const compilation = stats.compilation;
      const assets = compilation.assets;
      
      // Calculate bundle sizes
      const bundles: PerformanceMetrics['bundles'] = {
        main: 0,
        vendor: 0,
        total: 0,
        perRoute: {}
      };

      for (const [name, asset] of Object.entries(assets)) {
        const size = (asset as any).size() / 1024; // Convert to KB
        
        if (name.includes('main')) {
          bundles.main! += size;
        } else if (name.includes('vendor')) {
          bundles.vendor! += size;
        }
        
        bundles.total! += size;
      }

      // Check budgets
      const violations = this.monitor.checkBudget({ bundles });
      
      if (violations.length > 0) {
        const report = this.monitor.generateReport({ bundles });
        console.log(report);
        
        // Fail build on errors
        const errors = violations.filter(v => v.severity === 'error');
        if (errors.length > 0) {
          throw new Error(`Performance budget exceeded! ${errors.length} error(s) found.`);
        }
      }
    });
  }
}

// Export singleton instance
export const performanceBudgetMonitor = new PerformanceBudgetMonitor();
