/**
 * Enterprise Spell Analytics & Telemetry System
 * Comprehensive monitoring, metrics collection, and performance analysis
 */

import { EventEmitter } from "events";

export class SpellAnalytics extends EventEmitter {
  private metricsCollector: MetricsCollector;
  private performanceProfiler: PerformanceProfiler;
  private usageTracker: UsageTracker;
  private anomalyDetector: AnomalyDetector;
  private reportGenerator: ReportGenerator;

  constructor(config: AnalyticsConfig) {
    super();
    this.metricsCollector = new MetricsCollector(config.metrics);
    this.performanceProfiler = new PerformanceProfiler(config.performance);
    this.usageTracker = new UsageTracker(config.usage);
    this.anomalyDetector = new AnomalyDetector(config.anomaly);
    this.reportGenerator = new ReportGenerator(config.reporting);
  }

  async trackSpellCast(event: SpellCastEvent): Promise<void> {
    const startTime = performance.now();

    // Collect basic metrics
    await this.metricsCollector.recordSpellCast(event);

    // Track usage patterns
    await this.usageTracker.recordUsage(event);

    // Performance profiling
    const profile = await this.performanceProfiler.profileSpellCast(event);

    // Anomaly detection
    await this.anomalyDetector.checkForAnomalies(event, profile);

    const processingTime = performance.now() - startTime;
    this.emit("analytics_processed", { event, processingTime });
  }

  async generateReport(type: ReportType, timeRange: TimeRange): Promise<AnalyticsReport> {
    return this.reportGenerator.generate(type, timeRange);
  }

  async getMetrics(query: MetricsQuery): Promise<MetricsResult> {
    return this.metricsCollector.query(query);
  }

  async detectPerformanceIssues(): Promise<PerformanceIssue[]> {
    return this.performanceProfiler.detectIssues();
  }
}

class MetricsCollector {
  private metrics = new Map<string, MetricSeries>();
  private aggregates = new Map<string, AggregateMetric>();

  constructor(private config: MetricsConfig) {}

  async recordSpellCast(event: SpellCastEvent): Promise<void> {
    const timestamp = Date.now();

    // Record basic spell metrics
    this.recordMetric("spell_casts_total", 1, timestamp, {
      spell_id: event.spellId,
      level: event.level.toString(),
      school: event.school,
      caster_class: event.casterClass,
    });

    // Record performance metrics
    this.recordMetric("spell_cast_duration_ms", event.duration, timestamp, {
      spell_id: event.spellId,
    });

    // Record resource usage
    if (event.memoryUsage) {
      this.recordMetric("spell_memory_usage_bytes", event.memoryUsage, timestamp, {
        spell_id: event.spellId,
      });
    }

    // Update aggregates
    await this.updateAggregates(event);
  }

  private recordMetric(
    name: string,
    value: number,
    timestamp: number,
    labels: Record<string, string>,
  ): void {
    const key = `${name}:${JSON.stringify(labels)}`;

    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        name,
        labels,
        dataPoints: [],
        lastUpdated: timestamp,
      });
    }

    const series = this.metrics.get(key)!;
    series.dataPoints.push({ timestamp, value });
    series.lastUpdated = timestamp;

    // Keep only recent data points
    const cutoff = timestamp - 24 * 60 * 60 * 1000; // 24 hours
    series.dataPoints = series.dataPoints.filter((dp) => dp.timestamp > cutoff);
  }

  private async updateAggregates(event: SpellCastEvent): Promise<void> {
    // Update spell popularity
    const popularityKey = `spell_popularity:${event.spellId}`;
    if (!this.aggregates.has(popularityKey)) {
      this.aggregates.set(popularityKey, {
        name: "spell_popularity",
        value: 0,
        lastUpdated: Date.now(),
      });
    }
    this.aggregates.get(popularityKey)!.value++;

    // Update performance averages
    const perfKey = `avg_cast_time:${event.spellId}`;
    const existing = this.aggregates.get(perfKey);
    if (existing) {
      existing.value = (existing.value + event.duration) / 2;
    } else {
      this.aggregates.set(perfKey, {
        name: "avg_cast_time",
        value: event.duration,
        lastUpdated: Date.now(),
      });
    }
  }

  async query(query: MetricsQuery): Promise<MetricsResult> {
    const results: MetricSeries[] = [];

    for (const [_key, series] of this.metrics) {
      if (this.matchesQuery(series, query)) {
        const filteredSeries = this.filterByTimeRange(series, query.timeRange);
        results.push(filteredSeries);
      }
    }

    return {
      series: results,
      aggregates: this.getMatchingAggregates(query),
      query,
      timestamp: Date.now(),
    };
  }

  private matchesQuery(series: MetricSeries, query: MetricsQuery): boolean {
    if (query.metricName && series.name !== query.metricName) {return false;}

    if (query.labels) {
      for (const [key, value] of Object.entries(query.labels)) {
        if (series.labels[key] !== value) {return false;}
      }
    }

    return true;
  }

  private filterByTimeRange(series: MetricSeries, timeRange?: TimeRange): MetricSeries {
    if (!timeRange) {return series;}

    const filtered = {
      ...series,
      dataPoints: series.dataPoints.filter(
        (dp) => dp.timestamp >= timeRange.start && dp.timestamp <= timeRange.end,
      ),
    };

    return filtered;
  }

  private getMatchingAggregates(query: MetricsQuery): AggregateMetric[] {
    const results: AggregateMetric[] = [];

    for (const [key, aggregate] of this.aggregates) {
      if (!query.metricName || key.includes(query.metricName)) {
        results.push(aggregate);
      }
    }

    return results;
  }
}

class PerformanceProfiler {
  private profiles = new Map<string, PerformanceProfile>();
  private thresholds: PerformanceThresholds;

  constructor(private config: PerformanceConfig) {
    this.thresholds = config.thresholds;
  }

  async profileSpellCast(event: SpellCastEvent): Promise<PerformanceProfile> {
    const profile: PerformanceProfile = {
      spellId: event.spellId,
      timestamp: Date.now(),
      duration: event.duration,
      memoryUsage: event.memoryUsage || 0,
      cpuUsage: event.cpuUsage || 0,
      phases: event.phases || [],
      bottlenecks: [],
    };

    // Analyze performance bottlenecks
    profile.bottlenecks = this.identifyBottlenecks(profile);

    // Store profile
    this.profiles.set(`${event.spellId}:${profile.timestamp}`, profile);

    return profile;
  }

  private identifyBottlenecks(profile: PerformanceProfile): PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = [];

    // Check overall duration
    if (profile.duration > this.thresholds.maxCastTime) {
      bottlenecks.push({
        type: "duration",
        severity: profile.duration > this.thresholds.maxCastTime * 2 ? "critical" : "warning",
        value: profile.duration,
        threshold: this.thresholds.maxCastTime,
        description: `Spell cast took ${profile.duration}ms, exceeding threshold of ${this.thresholds.maxCastTime}ms`,
      });
    }

    // Check memory usage
    if (profile.memoryUsage > this.thresholds.maxMemoryUsage) {
      bottlenecks.push({
        type: "memory",
        severity: profile.memoryUsage > this.thresholds.maxMemoryUsage * 2 ? "critical" : "warning",
        value: profile.memoryUsage,
        threshold: this.thresholds.maxMemoryUsage,
        description: `Memory usage ${profile.memoryUsage} bytes exceeds threshold`,
      });
    }

    // Analyze phase bottlenecks
    for (const phase of profile.phases) {
      if (phase.duration > this.thresholds.maxPhaseTime) {
        bottlenecks.push({
          type: "phase",
          severity: "warning",
          value: phase.duration,
          threshold: this.thresholds.maxPhaseTime,
          description: `Phase '${phase.name}' took ${phase.duration}ms`,
        });
      }
    }

    return bottlenecks;
  }

  async detectIssues(): Promise<PerformanceIssue[]> {
    const issues: PerformanceIssue[] = [];
    const recentProfiles = this.getRecentProfiles(300000); // Last 5 minutes

    // Detect trending issues
    const avgDuration =
      recentProfiles.reduce((_sum, _p) => sum + p.duration, 0) / recentProfiles.length;
    if (avgDuration > this.thresholds.maxCastTime) {
      issues.push({
        type: "performance_degradation",
        severity: "warning",
        description: `Average spell cast time trending upward: ${avgDuration.toFixed(2)}ms`,
        affectedSpells: this.getSlowSpells(recentProfiles),
        timestamp: Date.now(),
      });
    }

    // Detect memory leaks
    const memoryTrend = this.analyzeMemoryTrend(recentProfiles);
    if (memoryTrend.isIncreasing && memoryTrend.rate > 1000) {
      // 1KB/minute
      issues.push({
        type: "memory_leak",
        severity: "critical",
        description: `Memory usage increasing at ${memoryTrend.rate} bytes/minute`,
        affectedSpells: [],
        timestamp: Date.now(),
      });
    }

    return issues;
  }

  private getRecentProfiles(timeWindow: number): PerformanceProfile[] {
    const cutoff = Date.now() - timeWindow;
    return Array.from(this.profiles.values()).filter((p) => p.timestamp > cutoff);
  }

  private getSlowSpells(profiles: PerformanceProfile[]): string[] {
    const slowSpells = profiles
      .filter((p) => p.duration > this.thresholds.maxCastTime)
      .map((p) => p.spellId);

    return [...new Set(slowSpells)];
  }

  private analyzeMemoryTrend(profiles: PerformanceProfile[]): MemoryTrend {
    if (profiles.length < 2) {return { isIncreasing: false, rate: 0 };}

    const sorted = profiles.sort((_a, _b) => a.timestamp - b.timestamp);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const timeDiff = (last.timestamp - first.timestamp) / 60000; // minutes
    const memoryDiff = last.memoryUsage - first.memoryUsage;

    return {
      isIncreasing: memoryDiff > 0,
      rate: timeDiff > 0 ? memoryDiff / timeDiff : 0,
    };
  }
}

class UsageTracker {
  private usageStats = new Map<string, UsageStats>();
  private sessionData = new Map<string, SessionData>();

  constructor(private config: UsageConfig) {}

  async recordUsage(event: SpellCastEvent): Promise<void> {
    // Update spell usage stats
    const spellKey = event.spellId;
    if (!this.usageStats.has(spellKey)) {
      this.usageStats.set(spellKey, {
        spellId: event.spellId,
        totalCasts: 0,
        uniqueUsers: new Set(),
        averageLevel: 0,
        popularTimes: new Map(),
        successRate: 0,
        totalSuccesses: 0,
      });
    }

    const stats = this.usageStats.get(spellKey)!;
    stats.totalCasts++;
    stats.uniqueUsers.add(event.casterId);
    stats.averageLevel =
      (stats.averageLevel * (stats.totalCasts - 1) + event.level) / stats.totalCasts;

    if (event.success) {
      stats.totalSuccesses++;
    }
    stats.successRate = stats.totalSuccesses / stats.totalCasts;

    // Track popular casting times
    const hour = new Date(event.timestamp).getHours();
    const currentCount = stats.popularTimes.get(hour) || 0;
    stats.popularTimes.set(hour, currentCount + 1);

    // Update session data
    await this.updateSessionData(event);
  }

  private async updateSessionData(event: SpellCastEvent): Promise<void> {
    const sessionKey = `${event.casterId}:${this.getSessionId(event.timestamp)}`;

    if (!this.sessionData.has(sessionKey)) {
      this.sessionData.set(sessionKey, {
        userId: event.casterId,
        sessionStart: event.timestamp,
        sessionEnd: event.timestamp,
        spellsCast: [],
        totalDamageDealt: 0,
        totalHealing: 0,
        favoriteSchool: "",
        averageSpellLevel: 0,
      });
    }

    const session = this.sessionData.get(sessionKey)!;
    session.sessionEnd = event.timestamp;
    session.spellsCast.push({
      spellId: event.spellId,
      timestamp: event.timestamp,
      level: event.level,
      success: event.success,
    });

    // Update session statistics
    session.averageSpellLevel =
      session.spellsCast.reduce((_sum, _s) => sum + s.level, 0) / session.spellsCast.length;

    // Track favorite school
    const schoolCounts = new Map<string, number>();
    session.spellsCast.forEach((_s) => {
      const count = schoolCounts.get(event.school) || 0;
      schoolCounts.set(event.school, count + 1);
    });

    let maxCount = 0;
    for (const [school, count] of schoolCounts) {
      if (count > maxCount) {
        maxCount = count;
        session.favoriteSchool = school;
      }
    }
  }

  private getSessionId(timestamp: number): string {
    // Group by hour for session tracking
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
  }

  getPopularSpells(limit: number = 10): PopularSpell[] {
    return Array.from(this.usageStats.values())
      .sort((_a, _b) => b.totalCasts - a.totalCasts)
      .slice(0, limit)
      .map((stats) => ({
        spellId: stats.spellId,
        totalCasts: stats.totalCasts,
        uniqueUsers: stats.uniqueUsers.size,
        successRate: stats.successRate,
        averageLevel: stats.averageLevel,
      }));
  }

  getUserInsights(userId: string): UserInsights {
    const userSessions = Array.from(this.sessionData.values()).filter(
      (session) => session.userId === userId,
    );

    const totalSpells = userSessions.reduce((_sum, _s) => sum + s.spellsCast.length, 0);
    const favoriteSchools = new Map<string, number>();

    userSessions.forEach((session) => {
      const count = favoriteSchools.get(session.favoriteSchool) || 0;
      favoriteSchools.set(session.favoriteSchool, count + 1);
    });

    const topSchool = Array.from(favoriteSchools.entries()).sort(([, a], [, b]) => b - a)[0];

    return {
      userId,
      totalSpellsCast: totalSpells,
      totalSessions: userSessions.length,
      favoriteSchool: topSchool ? topSchool[0] : "unknown",
      averageSpellsPerSession: totalSpells / userSessions.length,
      lastActive: Math.max(...userSessions.map((s) => s.sessionEnd)),
    };
  }
}

class AnomalyDetector {
  private baselines = new Map<string, PerformanceBaseline>();
  private anomalies: Anomaly[] = [];

  constructor(private config: AnomalyConfig) {}

  async checkForAnomalies(event: SpellCastEvent, profile: PerformanceProfile): Promise<void> {
    const baseline = this.getOrCreateBaseline(event.spellId);

    // Check for performance anomalies
    const durationAnomaly = this.detectDurationAnomaly(
      profile.duration,
      baseline.averageDuration,
      baseline.durationStdDev,
    );
    if (durationAnomaly) {
      this.recordAnomaly({
        type: "performance",
        spellId: event.spellId,
        severity: durationAnomaly.severity,
        description: `Spell cast duration ${profile.duration}ms is ${durationAnomaly.deviations.toFixed(1)} standard deviations from baseline`,
        timestamp: Date.now(),
        metadata: { duration: profile.duration, baseline: baseline.averageDuration },
      });
    }

    // Update baseline with new data
    this.updateBaseline(event.spellId, profile);
  }

  private getOrCreateBaseline(spellId: string): PerformanceBaseline {
    if (!this.baselines.has(spellId)) {
      this.baselines.set(spellId, {
        spellId,
        averageDuration: 0,
        durationStdDev: 0,
        averageMemory: 0,
        memoryStdDev: 0,
        sampleCount: 0,
        lastUpdated: Date.now(),
      });
    }
    return this.baselines.get(spellId)!;
  }

  private detectDurationAnomaly(
    duration: number,
    baseline: number,
    stdDev: number,
  ): { severity: "warning" | "critical"; deviations: number } | null {
    if (stdDev === 0) {return null;} // Not enough data

    const deviations = Math.abs(duration - baseline) / stdDev;

    if (deviations > this.config.criticalThreshold) {
      return { severity: "critical", deviations };
    } else if (deviations > this.config.warningThreshold) {
      return { severity: "warning", deviations };
    }

    return null;
  }

  private updateBaseline(spellId: string, profile: PerformanceProfile): void {
    const baseline = this.baselines.get(spellId)!;
    baseline.sampleCount++;

    // Update running average
    baseline.averageDuration =
      (baseline.averageDuration * (baseline.sampleCount - 1) + profile.duration) /
      baseline.sampleCount;
    baseline.averageMemory =
      (baseline.averageMemory * (baseline.sampleCount - 1) + profile.memoryUsage) /
      baseline.sampleCount;

    // Update standard deviation (simplified calculation)
    if (baseline.sampleCount > 1) {
      baseline.durationStdDev = Math.sqrt(
        Math.pow(profile.duration - baseline.averageDuration, 2) / baseline.sampleCount,
      );
    }

    baseline.lastUpdated = Date.now();
  }

  private recordAnomaly(anomaly: Anomaly): void {
    this.anomalies.push(anomaly);

    // Keep only recent anomalies
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    this.anomalies = this.anomalies.filter((a) => a.timestamp > cutoff);
  }

  getRecentAnomalies(timeWindow: number = 3600000): Anomaly[] {
    const cutoff = Date.now() - timeWindow;
    return this.anomalies.filter((a) => a.timestamp > cutoff);
  }
}

class ReportGenerator {
  constructor(private config: ReportingConfig) {}

  async generate(type: ReportType, timeRange: TimeRange): Promise<AnalyticsReport> {
    switch (type) {
      case "performance":
        return this.generatePerformanceReport(timeRange);
      case "usage":
        return this.generateUsageReport(timeRange);
      case "anomalies":
        return this.generateAnomalyReport(timeRange);
      default:
        throw new Error(`Unknown report type: ${type}`);
    }
  }

  private async generatePerformanceReport(timeRange: TimeRange): Promise<AnalyticsReport> {
    return {
      type: "performance",
      timeRange,
      generatedAt: Date.now(),
      summary: {
        totalSpellsCast: 0,
        averageCastTime: 0,
        slowestSpells: [],
        performanceIssues: 0,
      },
      details: Record<string, any>,
      recommendations: [],
    };
  }

  private async generateUsageReport(timeRange: TimeRange): Promise<AnalyticsReport> {
    return {
      type: "usage",
      timeRange,
      generatedAt: Date.now(),
      summary: {
        totalUsers: 0,
        popularSpells: [],
        peakUsageHours: [],
        schoolDistribution: Record<string, any>,
      },
      details: Record<string, any>,
      recommendations: [],
    };
  }

  private async generateAnomalyReport(timeRange: TimeRange): Promise<AnalyticsReport> {
    return {
      type: "anomalies",
      timeRange,
      generatedAt: Date.now(),
      summary: {
        totalAnomalies: 0,
        criticalAnomalies: 0,
        affectedSpells: [],
        anomalyTypes: Record<string, any>,
      },
      details: Record<string, any>,
      recommendations: [],
    };
  }
}

// Type definitions
interface AnalyticsConfig {
  metrics: MetricsConfig;
  performance: PerformanceConfig;
  usage: UsageConfig;
  anomaly: AnomalyConfig;
  reporting: ReportingConfig;
}

interface SpellCastEvent {
  spellId: string;
  casterId: string;
  casterClass: string;
  level: number;
  school: string;
  timestamp: number;
  duration: number;
  success: boolean;
  memoryUsage?: number;
  cpuUsage?: number;
  phases?: CastPhase[];
}

interface CastPhase {
  name: string;
  duration: number;
  memoryDelta: number;
}

interface MetricsConfig {
  retentionPeriod: number;
  aggregationInterval: number;
}

interface PerformanceConfig {
  thresholds: PerformanceThresholds;
  profilingEnabled: boolean;
}

interface PerformanceThresholds {
  maxCastTime: number;
  maxMemoryUsage: number;
  maxPhaseTime: number;
}

interface UsageConfig {
  trackSessions: boolean;
  sessionTimeout: number;
}

interface AnomalyConfig {
  warningThreshold: number;
  criticalThreshold: number;
  baselinePeriod: number;
}

interface ReportingConfig {
  autoGenerate: boolean;
  reportInterval: number;
}

type ReportType = "performance" | "usage" | "anomalies";

interface TimeRange {
  start: number;
  end: number;
}

interface MetricsQuery {
  metricName?: string;
  labels?: Record<string, string>;
  timeRange?: TimeRange;
}

interface MetricSeries {
  name: string;
  labels: Record<string, string>;
  dataPoints: DataPoint[];
  lastUpdated: number;
}

interface DataPoint {
  timestamp: number;
  value: number;
}

interface AggregateMetric {
  name: string;
  value: number;
  lastUpdated: number;
}

interface MetricsResult {
  series: MetricSeries[];
  aggregates: AggregateMetric[];
  query: MetricsQuery;
  timestamp: number;
}

interface PerformanceProfile {
  spellId: string;
  timestamp: number;
  duration: number;
  memoryUsage: number;
  cpuUsage: number;
  phases: CastPhase[];
  bottlenecks: PerformanceBottleneck[];
}

interface PerformanceBottleneck {
  type: string;
  severity: "warning" | "critical";
  value: number;
  threshold: number;
  description: string;
}

interface PerformanceIssue {
  type: string;
  severity: "warning" | "critical";
  description: string;
  affectedSpells: string[];
  timestamp: number;
}

interface MemoryTrend {
  isIncreasing: boolean;
  rate: number;
}

interface UsageStats {
  spellId: string;
  totalCasts: number;
  uniqueUsers: Set<string>;
  averageLevel: number;
  popularTimes: Map<number, number>;
  successRate: number;
  totalSuccesses: number;
}

interface SessionData {
  userId: string;
  sessionStart: number;
  sessionEnd: number;
  spellsCast: SessionSpell[];
  totalDamageDealt: number;
  totalHealing: number;
  favoriteSchool: string;
  averageSpellLevel: number;
}

interface SessionSpell {
  spellId: string;
  timestamp: number;
  level: number;
  success: boolean;
}

interface PopularSpell {
  spellId: string;
  totalCasts: number;
  uniqueUsers: number;
  successRate: number;
  averageLevel: number;
}

interface UserInsights {
  userId: string;
  totalSpellsCast: number;
  totalSessions: number;
  favoriteSchool: string;
  averageSpellsPerSession: number;
  lastActive: number;
}

interface PerformanceBaseline {
  spellId: string;
  averageDuration: number;
  durationStdDev: number;
  averageMemory: number;
  memoryStdDev: number;
  sampleCount: number;
  lastUpdated: number;
}

interface Anomaly {
  type: string;
  spellId: string;
  severity: "warning" | "critical";
  description: string;
  timestamp: number;
  metadata: Record<string, any>;
}

interface AnalyticsReport {
  type: ReportType;
  timeRange: TimeRange;
  generatedAt: number;
  summary: Record<string, any>;
  details: Record<string, any>;
  recommendations: string[];
}

export { SpellAnalytics };
