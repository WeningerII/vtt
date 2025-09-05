import { Reporter, TestCase, TestResult, FullResult } from "@playwright/test/reporter";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

/**
 * Custom E2E Test Reporter
 * Generates comprehensive test reports with performance metrics,
 * failure analysis, and CI/CD integration data
 */
export class E2ETestReporter implements Reporter {
  private startTime: number = 0;
  private testResults: TestResult[] = [];
  private performanceMetrics: any[] = [];
  private failureAnalysis: any[] = [];
  private coverageData: any = {};
  private suppressedStepIdWarnings: number = 0;
  private suppressedStepIdSamples: string[] = [];

  onBegin() {
    this.startTime = Date.now();
    console.log("🚀 Starting E2E Test Suite...");
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.testResults.push(result);

    // Collect performance metrics
    if (result.attachments) {
      result.attachments.forEach((attachment) => {
        if (attachment.name === "performance-metrics") {
          try {
            const metrics = JSON.parse(attachment.body?.toString() || "{}");
            this.performanceMetrics.push({
              testTitle: test.title,
              ...metrics,
            });
          } catch (e) {
            console.warn("Failed to parse performance metrics:", e);
          }
        }
      });
    }

    // Analyze failures
    if (result.status === "failed") {
      this.failureAnalysis.push({
        testTitle: test.title,
        testFile: test.location.file,
        error: result.error?.message,
        stack: result.error?.stack,
        duration: result.duration,
        retry: result.retry,
        attachments: result.attachments.map((a) => ({
          name: a.name,
          contentType: a.contentType,
          path: a.path,
        })),
      });
    }

    // Log test completion
    const status =
      result.status === "passed"
        ? "✅"
        : result.status === "failed"
          ? "❌"
          : result.status === "skipped"
            ? "⏭️"
            : "⚠️";

    console.log(`${status} ${test.title} (${result.duration}ms)`);
  }

  // Suppress noisy Playwright internal stderr: "Internal error: step id not found: fixture@..."
  // Keep other stderr visible to avoid masking legitimate issues.
  onStdErr(chunk: string | Buffer, _test?: TestCase, _result?: TestResult) {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    const line = text.trim();
    // Allow override via env for experimentation; default targets fixture step ids only.
    const patternEnv = process.env.PW_SUPPRESS_STEPID_PATTERN;
    const pattern = patternEnv
      ? new RegExp(patternEnv)
      : /^Internal error: step id not found: fixture@/;
    if (pattern.test(line)) {
      this.suppressedStepIdWarnings++;
      if (this.suppressedStepIdSamples.length < 5) {this.suppressedStepIdSamples.push(line);}
      return; // swallow only the targeted noise
    }
    // Pass through any other stderr
    // Ensure trailing newline
    if (!line.endsWith("\n")) {
      console.error(text);
    } else {
      process.stderr.write(text);
    }
  }

  onEnd(result: FullResult) {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    // Generate comprehensive report
    const report = this.generateReport(result, totalDuration);

    // Write reports to files
    this.writeReports(report);

    // Log summary
    this.logSummary(result, totalDuration);
  }

  private generateReport(result: FullResult, totalDuration: number) {
    const passedTests = this.testResults.filter((r) => r.status === "passed").length;
    const failedTests = this.testResults.filter((r) => r.status === "failed").length;
    const skippedTests = this.testResults.filter((r) => r.status === "skipped").length;
    const flakyTests = this.testResults.filter((r) => r.status === "passed" && r.retry > 0).length;

    return {
      summary: {
        status: result.status,
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: totalDuration,
        totalTests: this.testResults.length,
        passed: passedTests,
        failed: failedTests,
        skipped: skippedTests,
        flaky: flakyTests,
        passRate: ((passedTests / (passedTests + failedTests)) * 100).toFixed(2),
      },
      performance: {
        metrics: this.performanceMetrics,
        averages: this.calculatePerformanceAverages(),
        ...this.checkPerformanceThresholds(),
      },
      failures: {
        count: failedTests,
        analysis: this.failureAnalysis,
        patterns: this.analyzeFailurePatterns(),
      },
      coverage: this.coverageData,
      environment: {
        ci: process.env.CI === "true",
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        commit: process.env.GITHUB_SHA,
        branch: process.env.GITHUB_REF_NAME,
      },
      artifacts: {
        videos: this.testResults.filter((r) => r.attachments.some((a) => a.name === "video"))
          .length,
        traces: this.testResults.filter((r) => r.attachments.some((a) => a.name === "trace"))
          .length,
        screenshots: this.testResults.filter((r) =>
          r.attachments.some((a) => a.name === "screenshot"),
        ).length,
      },
      diagnostics: {
        suppressedStepIdNotFound: {
          count: this.suppressedStepIdWarnings,
          samples: this.suppressedStepIdSamples,
        },
      },
    };
  }

  private calculatePerformanceAverages() {
    if (this.performanceMetrics.length === 0) {return {};}

    const metrics = this.performanceMetrics;
    return {
      pageLoadTime: this.average(metrics.map((m) => m.pageLoadTime).filter(Boolean)),
      apiResponseTime: this.average(metrics.map((m) => m.apiResponseTime).filter(Boolean)),
      websocketLatency: this.average(metrics.map((m) => m.websocketLatency).filter(Boolean)),
      memoryUsage: this.average(metrics.map((m) => m.memoryUsage).filter(Boolean)),
      networkBandwidth: this.average(metrics.map((m) => m.networkBandwidth).filter(Boolean)),
    };
  }

  private checkPerformanceThresholds() {
    const averages = this.calculatePerformanceAverages();
    const thresholds = {
      pageLoadTime: 15000,
      apiResponseTime: 2000,
      websocketLatency: 500,
      memoryUsage: 50 * 1024 * 1024, // 50MB
      networkBandwidth: 500 * 1024, // 500KB
    };

    const violations: any[] = [];

    Object.entries(averages).forEach(([metric, value]) => {
      const threshold = thresholds[metric as keyof typeof thresholds];
      if (typeof value === "number" && typeof threshold === "number" && value > threshold) {
        violations.push({
          metric,
          value,
          threshold,
          exceeded: `${(((value - threshold) / threshold) * 100).toFixed(2)  }%`,
        });
      }
    });

    return {
      thresholds,
      violations,
      passed: violations.length === 0,
    };
  }

  private analyzeFailurePatterns() {
    const patterns: any = {};

    this.failureAnalysis.forEach((failure) => {
      // Group by error type
      const errorType = this.categorizeError(failure.error);
      if (!patterns[errorType]) {
        patterns[errorType] = [];
      }
      patterns[errorType].push(failure);
    });

    return Object.entries(patterns).map(([type, failures]) => ({
      type,
      count: (failures as any[]).length,
      percentage: (
        ((failures as any[]).length / Math.max(this.failureAnalysis.length, 1)) *
        100
      ).toFixed(2),
      examples: (failures as any[]).slice(0, 3).map((f: any) => f.testTitle),
    }));
  }

  private categorizeError(error?: string): string {
    if (!error) {return "Unknown";}

    if (error.includes("timeout")) {return "Timeout";}
    if (error.includes("network") || error.includes("fetch")) {return "Network";}
    if (error.includes("element") || error.includes("selector")) {return "Element Not Found";}
    if (error.includes("assertion") || error.includes("expect")) {return "Assertion";}
    if (error.includes("websocket") || error.includes("ws")) {return "WebSocket";}
    if (error.includes("database") || error.includes("prisma")) {return "Database";}
    if (error.includes("auth")) {return "Authentication";}

    return "Other";
  }

  private writeReports(report: any) {
    const reportsDir = join(process.cwd(), "test-results", "reports");

    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    // Write JSON report
    writeFileSync(join(reportsDir, "e2e-report.json"), JSON.stringify(report, null, 2));

    // Write HTML report
    const htmlReport = this.generateHTMLReport(report);
    writeFileSync(join(reportsDir, "e2e-report.html"), htmlReport);

    // Write CI summary
    const ciSummary = this.generateCISummary(report);
    writeFileSync(join(reportsDir, "ci-summary.md"), ciSummary);

    // Write performance report
    if (this.performanceMetrics.length > 0) {
      writeFileSync(
        join(reportsDir, "performance-report.json"),
        JSON.stringify(
          {
            metrics: this.performanceMetrics,
            averages: report.performance.averages,
            thresholds: report.performance.thresholds,
          },
          null,
          2,
        ),
      );
    }
  }

  private generateHTMLReport(report: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>E2E Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .warning { color: #ffc107; }
        .section { margin: 30px 0; }
        .failure { background: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; margin: 10px 0; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>E2E Test Report</h1>
        <p><strong>Status:</strong> <span class="${report.summary.status === "passed" ? "passed" : "failed"}">${report.summary.status.toUpperCase()}</span></p>
        <p><strong>Duration:</strong> ${(report.summary.duration / 1000).toFixed(2)}s</p>
        <p><strong>Generated:</strong> ${report.summary.endTime}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <div style="font-size: 24px; font-weight: bold;">${report.summary.totalTests}</div>
        </div>
        <div class="metric">
            <h3>Passed</h3>
            <div style="font-size: 24px; font-weight: bold; color: #28a745;">${report.summary.passed}</div>
        </div>
        <div class="metric">
            <h3>Failed</h3>
            <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${report.summary.failed}</div>
        </div>
        <div class="metric">
            <h3>Pass Rate</h3>
            <div style="font-size: 24px; font-weight: bold;">${report.summary.passRate}%</div>
        </div>
    </div>

    ${
      report.performance.violations.length > 0
        ? `
    <div class="section">
        <h2>⚠️ Performance Threshold Violations</h2>
        <table>
            <tr><th>Metric</th><th>Value</th><th>Threshold</th><th>Exceeded By</th></tr>
            ${report.performance.violations
              .map(
                (v: any) => `
                <tr>
                    <td>${v.metric}</td>
                    <td>${v.value}</td>
                    <td>${v.threshold}</td>
                    <td class="warning">${v.exceeded}</td>
                </tr>
            `,
              )
              .join("")}
        </table>
    </div>
    `
        : ""
    }

    ${
      report.failures.count > 0
        ? `
    <div class="section">
        <h2>❌ Failure Analysis</h2>
        <h3>Failure Patterns</h3>
        <table>
            <tr><th>Error Type</th><th>Count</th><th>Percentage</th><th>Examples</th></tr>
            ${report.failures.patterns
              .map(
                (p: any) => `
                <tr>
                    <td>${p.type}</td>
                    <td>${p.count}</td>
                    <td>${p.percentage}%</td>
                    <td>${p.examples.join(", ")}</td>
                </tr>
            `,
              )
              .join("")}
        </table>
    </div>
    `
        : ""
    }

    <div class="section">
        <h2>📊 Test Artifacts</h2>
        <p><strong>Videos:</strong> ${report.artifacts.videos}</p>
        <p><strong>Traces:</strong> ${report.artifacts.traces}</p>
        <p><strong>Screenshots:</strong> ${report.artifacts.screenshots}</p>
    </div>
</body>
</html>
    `;
  }

  private generateCISummary(report: any): string {
    const status = report.summary.status === "passed" ? "✅" : "❌";

    return `# E2E Test Results ${status}

## Summary
- **Status:** ${report.summary.status.toUpperCase()}
- **Total Tests:** ${report.summary.totalTests}
- **Passed:** ${report.summary.passed}
- **Failed:** ${report.summary.failed}
- **Pass Rate:** ${report.summary.passRate}%
- **Duration:** ${(report.summary.duration / 1000).toFixed(2)}s

${
  report.performance.violations.length > 0
    ? `
## ⚠️ Performance Issues
${report.performance.violations.map((v: any) => `- **${v.metric}:** ${v.value} (exceeded threshold by ${v.exceeded})`).join("\n")}
`
    : ""
}

${
  report.failures.count > 0
    ? `
## ❌ Failures
${report.failures.patterns.map((p: any) => `- **${p.type}:** ${p.count} failures (${p.percentage}%)`).join("\n")}
`
    : ""
}

## Environment
- **CI:** ${report.environment.ci}
- **Node:** ${report.environment.nodeVersion}
- **Platform:** ${report.environment.platform}
- **Commit:** ${report.environment.commit || "N/A"}
`;
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) {return 0;}
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private logSummary(result: FullResult, totalDuration: number) {
    const passed = this.testResults.filter((r) => r.status === "passed").length;
    const failed = this.testResults.filter((r) => r.status === "failed").length;
    const passRate = ((passed / (passed + failed)) * 100).toFixed(2);

    console.log("\n📊 E2E Test Summary:");
    console.log(`   Status: ${result.status === "passed" ? "✅ PASSED" : "❌ FAILED"}`);
    console.log(`   Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`   Tests: ${this.testResults.length} total, ${passed} passed, ${failed} failed`);
    console.log(`   Pass Rate: ${passRate}%`);

    if (this.performanceMetrics.length > 0) {
      console.log(`   Performance Metrics: ${this.performanceMetrics.length} collected`);
    }
    if (this.suppressedStepIdWarnings > 0) {
      console.log(
        `   Suppressed noisy internal messages: ${this.suppressedStepIdWarnings} (pattern: ${process.env.PW_SUPPRESS_STEPID_PATTERN || "^Internal error: step id not found: fixture@"})`,
      );
    }

    console.log(`   Reports: test-results/reports/`);
  }
}

export default E2ETestReporter;
