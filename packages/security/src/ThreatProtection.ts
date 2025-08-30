/**
 * Threat Protection System
 * Advanced security monitoring, anomaly detection, and automated threat response
 */

import { EventEmitter } from "events";

export interface SecurityEvent {
  id: string;
  type: ThreatType;
  severity: "low" | "medium" | "high" | "critical";
  source: string; // IP address, user ID, etc.
  description: string;
  metadata: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
}

export type ThreatType =
  | "brute_force"
  | "sql_injection"
  | "xss_attempt"
  | "suspicious_activity"
  | "rate_limit_violation"
  | "unauthorized_access"
  | "malformed_request"
  | "file_upload_threat"
  | "session_hijacking"
  | "csrf_attempt";

export interface ThreatRule {
  id: string;
  name: string;
  type: ThreatType;
  enabled: boolean;
  detector: (context: SecurityContext) => ThreatDetectionResult;
  threshold?: number;
  timeWindow?: number; // milliseconds
  actions: ThreatAction[];
}

export interface SecurityContext {
  request?: {
    ip: string;
    userAgent: string;
    path: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
  };
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
  session?: {
    id: string;
    createdAt: Date;
    lastActivity: Date;
  };
  metadata?: Record<string, any>;
}

export interface ThreatDetectionResult {
  threat: boolean;
  confidence: number; // 0-1
  description: string;
  evidence: Record<string, any>;
}

export interface ThreatAction {
  type: "block" | "limit" | "alert" | "log" | "captcha" | "quarantine";
  duration?: number; // milliseconds
  metadata?: Record<string, any>;
}

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<ThreatType, number>;
  eventsBySeverity: Record<string, number>;
  blockedRequests: number;
  falsePositives: number;
  responseTime: number;
}

export class ThreatProtection extends EventEmitter {
  private rules = new Map<string, ThreatRule>();
  private events: SecurityEvent[] = [];
  private blockedIPs = new Set<string>();
  private suspiciousActivity = new Map<string, { count: number; lastSeen: Date }>();
  private quarantineList = new Set<string>();
  private maxEvents = 10000;

  constructor() {
    super();
    this.setupDefaultRules();
    this.startCleanupTimer();
  }

  /**
   * Analyze request for potential threats
   */
  analyzeRequest(context: SecurityContext): {
    threats: SecurityEvent[];
    blocked: boolean;
    actions: ThreatAction[];
  } {
    const threats: SecurityEvent[] = [];
    const actions: ThreatAction[] = [];
    let blocked = false;

    // Check if source is already blocked
    if (context.request?.ip && this.isBlocked(context.request.ip)) {
      blocked = true;
      actions.push({ type: "block", metadata: { reason: "ip_blocked" } });
    }

    // Run threat detection rules
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        const result = rule.detector(context);

        if (result.threat && result.confidence > 0.5) {
          const event = this.createSecurityEvent(rule.type, context, result);
          threats.push(event);

          // Execute rule actions
          for (const action of rule.actions) {
            if (action.type === "block") {
              blocked = true;
            }
            actions.push(action);
          }

          this.emit("threatDetected", { event, rule, context });
        }
      } catch (error) {
        this.emit("ruleError", { rule: rule.id, error, context });
      }
    }

    // Apply actions
    this.executeActions(actions, context);

    return { threats, blocked, actions };
  }

  /**
   * Report security incident
   */
  reportIncident(
    type: ThreatType,
    source: string,
    description: string,
    severity: SecurityEvent["severity"] = "medium",
    metadata: Record<string, any> = {},
  ): SecurityEvent {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      type,
      severity,
      source,
      description,
      metadata,
      timestamp: new Date(),
      resolved: false,
    };

    this.addEvent(event);
    this.emit("incidentReported", event);

    return event;
  }

  /**
   * Block IP address
   */
  blockIP(ip: string, duration?: number): void {
    this.blockedIPs.add(ip);

    if (duration) {
      setTimeout(() => {
        this.blockedIPs.delete(ip);
        this.emit("ipUnblocked", { ip });
      }, duration);
    }

    this.emit("ipBlocked", { ip, duration });
  }

  /**
   * Check if IP is blocked
   */
  isBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip) || this.quarantineList.has(ip);
  }

  /**
   * Add to quarantine list
   */
  quarantine(identifier: string, reason: string): void {
    this.quarantineList.add(identifier);
    this.emit("quarantined", { identifier, reason });
  }

  /**
   * Remove from quarantine
   */
  unquarantine(identifier: string): void {
    this.quarantineList.delete(identifier);
    this.emit("unquarantined", { identifier });
  }

  /**
   * Register custom threat rule
   */
  addRule(rule: ThreatRule): void {
    this.rules.set(rule.id, rule);
    this.emit("ruleAdded", rule);
  }

  /**
   * Remove threat rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.emit("ruleRemoved", { ruleId });
  }

  /**
   * Get security metrics
   */
  getMetrics(): SecurityMetrics {
    const eventsByType: Record<ThreatType, number> = {
      brute_force: 0,
      sql_injection: 0,
      xss_attempt: 0,
      suspicious_activity: 0,
      rate_limit_violation: 0,
      unauthorized_access: 0,
      malformed_request: 0,
      file_upload_threat: 0,
      session_hijacking: 0,
      csrf_attempt: 0,
    };
    const eventsBySeverity: Record<string, number> = {};
    let blockedRequests = 0;

    for (const event of this.events) {
      eventsByType[event.type] += 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;

      if (event.metadata.blocked === true) {
        blockedRequests++;
      }
    }

    return {
      totalEvents: this.events.length,
      eventsByType,
      eventsBySeverity,
      blockedRequests,
      falsePositives: this.events.filter((e) => e.metadata.falsePositive === true).length,
      responseTime: 0, // Would be calculated from actual response times
    };
  }

  /**
   * Get recent security events
   */
  getRecentEvents(limit = 100): SecurityEvent[] {
    return this.events.slice(-limit).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Mark event as resolved
   */
  resolveEvent(eventId: string): boolean {
    const event = this.events.find((e) => e.id === eventId);
    if (event) {
      event.resolved = true;
      this.emit("eventResolved", event);
      return true;
    }
    return false;
  }

  /**
   * Mark event as false positive
   */
  markFalsePositive(eventId: string): boolean {
    const event = this.events.find((e) => e.id === eventId);
    if (event) {
      event.metadata.falsePositive = true;
      event.resolved = true;
      this.emit("falsePositiveMarked", event);
      return true;
    }
    return false;
  }

  private setupDefaultRules(): void {
    // Brute force detection
    this.addRule({
      id: "brute_force_login",
      name: "Brute Force Login Detection",
      type: "brute_force",
      enabled: true,
      threshold: 5,
      timeWindow: 15 * 60 * 1000, // 15 minutes
      detector: (context) => {
        if (!context.request || !context.request.path.includes("/login")) {
          return { threat: false, confidence: 0, description: "", evidence: {} };
        }

        const ip = context.request.ip;
        const activity = this.suspiciousActivity.get(ip);
        const now = new Date();
        const bruteForceRule = this.rules.get("brute_force_login");
        const timeWindowMs = bruteForceRule?.timeWindow ?? 15 * 60 * 1000; // default 15m
        const threshold = bruteForceRule?.threshold ?? 5; // default 5 attempts

        if (!activity) {
          this.suspiciousActivity.set(ip, { count: 1, lastSeen: now });
          return { threat: false, confidence: 0, description: "", evidence: {} };
        }

        // Check if within time window
        if (now.getTime() - activity.lastSeen.getTime() < timeWindowMs) {
          activity.count++;
          activity.lastSeen = now;

          if (activity.count >= threshold) {
            return {
              threat: true,
              confidence: 0.9,
              description: `Brute force login attempt detected from ${ip}`,
              evidence: { attempts: activity.count, timeWindow: "15m" },
            };
          }
        } else {
          // Reset counter after time window
          activity.count = 1;
          activity.lastSeen = now;
        }

        return { threat: false, confidence: 0, description: "", evidence: {} };
      },
      actions: [
        { type: "block", duration: 60 * 60 * 1000 }, // Block for 1 hour
        { type: "alert" },
      ],
    });

    // SQL injection detection
    this.addRule({
      id: "sql_injection",
      name: "SQL Injection Detection",
      type: "sql_injection",
      enabled: true,
      detector: (context) => {
        if (!context.request?.body && !context.request?.path) {
          return { threat: false, confidence: 0, description: "", evidence: {} };
        }

        const content = JSON.stringify(context.request.body) + context.request.path;
        const sqlPatterns = [
          /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
          /(\b(UNION|OR|AND)\b.*\b(SELECT|INSERT|UPDATE|DELETE)\b)/i,
          /(--|#|\/\*|\*\/)/,
          /(\b(SLEEP|BENCHMARK|WAITFOR)\b)/i,
        ];

        for (const pattern of sqlPatterns) {
          if (pattern.test(content)) {
            return {
              threat: true,
              confidence: 0.8,
              description: "Potential SQL injection detected",
              evidence: { pattern: pattern.toString(), content: content.substring(0, 200) },
            };
          }
        }

        return { threat: false, confidence: 0, description: "", evidence: {} };
      },
      actions: [{ type: "block" }, { type: "alert" }, { type: "log" }],
    });

    // XSS detection
    this.addRule({
      id: "xss_detection",
      name: "XSS Attack Detection",
      type: "xss_attempt",
      enabled: true,
      detector: (context) => {
        if (!context.request?.body) {
          return { threat: false, confidence: 0, description: "", evidence: {} };
        }

        const content = JSON.stringify(context.request.body);
        const xssPatterns = [
          /<script[^>]*>.*?<\/script>/gi,
          /javascript:/gi,
          /on\w+\s*=/gi,
          /<iframe[^>]*>/gi,
          /<object[^>]*>/gi,
          /eval\s*\(/gi,
        ];

        for (const pattern of xssPatterns) {
          if (pattern.test(content)) {
            return {
              threat: true,
              confidence: 0.85,
              description: "Potential XSS attack detected",
              evidence: { pattern: pattern.toString(), content: content.substring(0, 200) },
            };
          }
        }

        return { threat: false, confidence: 0, description: "", evidence: {} };
      },
      actions: [{ type: "block" }, { type: "alert" }, { type: "log" }],
    });

    // Suspicious user agent detection
    this.addRule({
      id: "suspicious_user_agent",
      name: "Suspicious User Agent Detection",
      type: "suspicious_activity",
      enabled: true,
      detector: (context) => {
        const userAgent = context.request?.userAgent?.toLowerCase();
        if (!userAgent) {
          return { threat: false, confidence: 0, description: "", evidence: {} };
        }

        const suspiciousPatterns = [
          /bot|crawler|spider|scraper/,
          /curl|wget|python|perl|php/,
          /sqlmap|nikto|nmap|masscan/,
          /burp|owasp|zap/,
        ];

        const normalPatterns = [
          /googlebot|bingbot|slurp|duckduckbot/,
          /facebook|twitter|linkedin|discord/,
        ];

        // Check if it's a known good bot
        if (normalPatterns.some((pattern) => pattern.test(userAgent))) {
          return { threat: false, confidence: 0, description: "", evidence: {} };
        }

        // Check for suspicious patterns
        const matchedPattern = suspiciousPatterns.find((pattern) => pattern.test(userAgent));
        if (matchedPattern) {
          return {
            threat: true,
            confidence: 0.7,
            description: "Suspicious user agent detected",
            evidence: { userAgent, pattern: matchedPattern.toString() },
          };
        }

        return { threat: false, confidence: 0, description: "", evidence: {} };
      },
      actions: [{ type: "limit" }, { type: "log" }],
    });

    // File upload threat detection
    this.addRule({
      id: "malicious_file_upload",
      name: "Malicious File Upload Detection",
      type: "file_upload_threat",
      enabled: true,
      detector: (context) => {
        if (!context.request?.path.includes("/upload") && !context.metadata?.filename) {
          return { threat: false, confidence: 0, description: "", evidence: {} };
        }

        const filename = context.metadata?.filename?.toLowerCase();
        if (!filename) {
          return { threat: false, confidence: 0, description: "", evidence: {} };
        }

        // Check for dangerous extensions
        const dangerousExtensions = [
          ".exe",
          ".bat",
          ".cmd",
          ".com",
          ".pif",
          ".scr",
          ".vbs",
          ".js",
          ".jar",
          ".zip",
          ".rar",
          ".7z",
          ".tar",
          ".gz",
          ".php",
          ".asp",
          ".jsp",
          ".py",
          ".pl",
          ".sh",
        ];

        const hasDangerousExtension = dangerousExtensions.some((ext) => filename.endsWith(ext));

        // Check for double extensions
        const hasDoubleExtension = /\.[^.]+\.[^.]+$/.test(filename);

        // Check for suspicious names
        const suspiciousNames = ["shell", "backdoor", "exploit", "payload", "reverse"];
        const hasSuspiciousName = suspiciousNames.some((name) => filename.includes(name));

        if (hasDangerousExtension || hasDoubleExtension || hasSuspiciousName) {
          return {
            threat: true,
            confidence: 0.9,
            description: "Potentially malicious file upload detected",
            evidence: {
              filename,
              dangerousExtension: hasDangerousExtension,
              doubleExtension: hasDoubleExtension,
              suspiciousName: hasSuspiciousName,
            },
          };
        }

        return { threat: false, confidence: 0, description: "", evidence: {} };
      },
      actions: [{ type: "block" }, { type: "quarantine" }, { type: "alert" }],
    });
  }

  private createSecurityEvent(
    type: ThreatType,
    context: SecurityContext,
    result: ThreatDetectionResult,
  ): SecurityEvent {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      type,
      severity: this.calculateSeverity(type, result.confidence),
      source: context.request?.ip || context.user?.id || "unknown",
      description: result.description,
      metadata: {
        confidence: result.confidence,
        evidence: result.evidence,
        context: {
          path: context.request?.path,
          method: context.request?.method,
          userAgent: context.request?.userAgent,
          userId: context.user?.id,
        },
      },
      timestamp: new Date(),
      resolved: false,
    };

    this.addEvent(event);
    return event;
  }

  private calculateSeverity(type: ThreatType, confidence: number): SecurityEvent["severity"] {
    const baseSeverity: Record<ThreatType, number> = {
      sql_injection: 4,
      xss_attempt: 3,
      brute_force: 3,
      file_upload_threat: 4,
      session_hijacking: 4,
      csrf_attempt: 3,
      unauthorized_access: 3,
      suspicious_activity: 2,
      rate_limit_violation: 1,
      malformed_request: 1,
    };

    const score = (baseSeverity[type] || 2) * confidence;

    if (score >= 3.5) return "critical";
    if (score >= 2.5) return "high";
    if (score >= 1.5) return "medium";
    return "low";
  }

  private executeActions(actions: ThreatAction[], context: SecurityContext): void {
    for (const action of actions) {
      switch (action.type) {
        case "block":
          if (context.request?.ip) {
            this.blockIP(context.request.ip, action.duration);
          }
          break;

        case "quarantine":
          if (context.user?.id) {
            this.quarantine(context.user.id, "Threat detected");
          }
          break;

        case "alert":
          this.emit("securityAlert", { action, context });
          break;

        case "log":
          this.emit("securityLog", { action, context });
          break;
      }
    }
  }

  private addEvent(event: SecurityEvent): void {
    this.events.push(event);

    // Keep events within limit
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private startCleanupTimer(): void {
    // Clean up old suspicious activity records every hour
    setInterval(
      () => {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        for (const [ip, activity] of this.suspiciousActivity) {
          if (activity.lastSeen < oneHourAgo) {
            this.suspiciousActivity.delete(ip);
          }
        }
      },
      60 * 60 * 1000,
    );
  }
}
