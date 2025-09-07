import { logger } from '@vtt/logging';

export interface TelemetryEvent {
  id: string;
  type: string;
  category: 'performance' | 'user' | 'system' | 'error' | 'business';
  timestamp: number;
  sessionId: string;
  userId?: string;
  data: Record<string, any>;
  metadata: TelemetryMetadata;
}

export interface TelemetryMetadata {
  platform: string;
  version: string;
  build: string;
  userAgent: string;
  screen: { width: number; height: number };
  viewport: { width: number; height: number };
  timezone: string;
  language: string;
  referrer?: string;
}

export interface TelemetryConfig {
  endpoint: string;
  batchSize: number;
  flushInterval: number; // ms
  maxRetries: number;
  retryDelay: number; // ms
  enabledCategories: string[];
  samplingRate: number; // 0-1
  enableLocalStorage: boolean;
  enableErrorTracking: boolean;
  enablePerformanceTracking: boolean;
  enableUserTracking: boolean;
  privacyMode: boolean;
}

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  renderTime: number;
  memoryUsage: number;
  drawCalls: number;
  triangles: number;
  loadTime: number;
  networkLatency: number;
  errorRate: number;
}

export interface UserMetrics {
  sessionDuration: number;
  actionsPerSession: number;
  featuresUsed: string[];
  conversionEvents: string[];
  abandonmentPoints: string[];
  satisfactionScore?: number;
}

export interface SystemMetrics {
  crashRate: number;
  errorRate: number;
  uptime: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    gpu: number;
    network: number;
  };
  featureUsage: Record<string, number>;
}

export class TelemetrySystem {
  private config: TelemetryConfig;
  private eventQueue: TelemetryEvent[] = [];
  private sessionId: string;
  private userId?: string;
  private isInitialized = false;
  private flushTimer?: number;
  private metadata: TelemetryMetadata;
  
  // Performance tracking
  private performanceMetrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    drawCalls: 0,
    triangles: 0,
    loadTime: 0,
    networkLatency: 0,
    errorRate: 0
  };
  
  // User tracking
  private userMetrics: UserMetrics = {
    sessionDuration: 0,
    actionsPerSession: 0,
    featuresUsed: [],
    conversionEvents: [],
    abandonmentPoints: [],
  };
  
  // System tracking
  private systemMetrics: SystemMetrics = {
    crashRate: 0,
    errorRate: 0,
    uptime: 0,
    resourceUsage: { cpu: 0, memory: 0, gpu: 0, network: 0 },
    featureUsage: {} as Record<string, any>
  };
  
  private sessionStartTime = Date.now();
  private eventCount = 0;
  private errorCount = 0;
  private lastFlushTime = Date.now();
  
  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = {
      endpoint: '',
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000,
      enabledCategories: ['performance', 'user', 'system', 'error'],
      samplingRate: 1.0,
      enableLocalStorage: true,
      enableErrorTracking: true,
      enablePerformanceTracking: true,
      enableUserTracking: true,
      privacyMode: false,
      ...config
    };
    
    this.sessionId = this.generateSessionId();
    this.metadata = this.collectMetadata();
  }
  
  public async initialize(userId?: string): Promise<void> {
    if (this.isInitialized) {return;}
    
    this.userId = userId;
    this.isInitialized = true;
    
    // Load persisted events from local storage
    if (this.config.enableLocalStorage) {
      await this.loadPersistedEvents();
    }
    
    // Setup automatic flushing
    this.setupAutoFlush();
    
    // Setup error tracking
    if (this.config.enableErrorTracking) {
      this.setupErrorTracking();
    }
    
    // Setup performance tracking
    if (this.config.enablePerformanceTracking) {
      this.setupPerformanceTracking();
    }
    
    // Setup page visibility tracking
    this.setupVisibilityTracking();
    
    // Track initialization
    this.track('system.initialized', {
      config: this.sanitizeConfig(),
      metadata: this.metadata
    });
    
    logger.info('TelemetrySystem initialized');
  }
  
  public track(type: string, data: Record<string, any> = {}, category: TelemetryEvent['category'] = 'user'): void {
    if (!this.isInitialized || !this.shouldSample()) {return;}
    
    if (!this.config.enabledCategories.includes(category)) {return;}
    
    const event: TelemetryEvent = {
      id: this.generateEventId(),
      type,
      category,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
      data: this.config.privacyMode ? this.sanitizeData(data) : data,
      metadata: this.metadata
    };
    
    this.eventQueue.push(event);
    this.eventCount++;
    
    if (category === 'user') {
      this.userMetrics.actionsPerSession++;
      if (!this.userMetrics.featuresUsed.includes(type)) {
        this.userMetrics.featuresUsed.push(type);
      }
    }
    
    if (category === 'system') {
      this.systemMetrics.featureUsage[type] = (this.systemMetrics.featureUsage[type] || 0) + 1;
    }
    
    // Flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
    
    // Persist to local storage
    if (this.config.enableLocalStorage) {
      this.persistEvents();
    }
  }
  
  public trackError(error: Error, context: Record<string, any> = {}): void {
    this.errorCount++;
    
    const errorData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    };
    
    this.track('error.caught', errorData, 'error');
    
    // Update error rate
    this.systemMetrics.errorRate = this.errorCount / this.eventCount;
  }
  
  public trackPerformance(metrics: Partial<PerformanceMetrics>): void {
    this.performanceMetrics = { ...this.performanceMetrics, ...metrics };
    
    this.track('performance.metrics', this.performanceMetrics, 'performance');
  }
  
  public trackUserAction(action: string, target?: string, value?: any): void {
    this.track('user.action', {
      action,
      target,
      value,
      timestamp: Date.now()
    }, 'user');
  }
  
  public trackPageView(page: string, referrer?: string): void {
    this.track('user.pageview', {
      page,
      referrer: referrer || document.referrer,
      timestamp: Date.now()
    }, 'user');
  }
  
  public trackConversion(event: string, value?: number): void {
    this.userMetrics.conversionEvents.push(event);
    
    this.track('user.conversion', {
      event,
      value,
      timestamp: Date.now()
    }, 'business');
  }
  
  public trackCustomEvent(name: string, properties: Record<string, any> = {}): void {
    this.track(`custom.${name}`, properties, 'user');
  }
  
  public startTiming(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.track('performance.timing', {
        name,
        duration,
        startTime
      }, 'performance');
    };
  }
  
  public async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {return;}
    
    const events = [...this.eventQueue];
    this.eventQueue = [];
    
    try {
      await this.sendEvents(events);
      this.lastFlushTime = Date.now();
      
      // Clear persisted events on successful flush
      if (this.config.enableLocalStorage) {
        localStorage.removeItem('telemetry_events');
      }
      
    } catch (error) {
      logger.error('Failed to flush telemetry events:', error as Record<string, any> | undefined);
      
      // Put events back in queue for retry
      this.eventQueue.unshift(...events);
    }
  }
  
  public setUserId(userId: string): void {
    this.userId = userId;
    this.track('user.identified', { userId }, 'user');
  }
  
  public updateConfig(updates: Partial<TelemetryConfig>): void {
    this.config = { ...this.config, ...updates };
    this.track('system.config_updated', { updates }, 'system');
  }
  
  public getMetrics(): {
    performance: PerformanceMetrics;
    user: UserMetrics;
    system: SystemMetrics;
  } {
    // Update session duration
    this.userMetrics.sessionDuration = Date.now() - this.sessionStartTime;
    this.systemMetrics.uptime = Date.now() - this.sessionStartTime;
    
    return {
      performance: { ...this.performanceMetrics },
      user: { ...this.userMetrics },
      system: { ...this.systemMetrics }
    };
  }
  
  public async dispose(): Promise<void> {
    // Track session end
    this.track('user.session_end', {
      duration: Date.now() - this.sessionStartTime,
      eventCount: this.eventCount,
      errorCount: this.errorCount
    }, 'user');
    
    // Final flush
    await this.flush();
    
    // Clear timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.isInitialized = false;
    logger.info('TelemetrySystem disposed');
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private collectMetadata(): TelemetryMetadata {
    return {
      platform: navigator.platform,
      version: '1.0.0', // Would come from build config
      build: 'development', // Would come from build config
      userAgent: navigator.userAgent,
      screen: {
        width: screen.width,
        height: screen.height
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      referrer: document.referrer
    };
  }
  
  private shouldSample(): boolean {
    return Math.random() < this.config.samplingRate;
  }
  
  private sanitizeConfig(): Partial<TelemetryConfig> {
    const { endpoint, ...safeConfig } = this.config;
    return safeConfig;
  }
  
  private sanitizeData(data: Record<string, any>): Record<string, any> {
    // Remove potentially sensitive data in privacy mode
    const sanitized = { ...data };
    
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'email', 'phone'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  private async sendEvents(events: TelemetryEvent[]): Promise<void> {
    if (!this.config.endpoint) {
      logger.warn('No telemetry endpoint configured');
      return;
    }
    
    const payload = {
      events,
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: Date.now()
    };
    
    let retries = 0;
    
    while (retries <= this.config.maxRetries) {
      try {
        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
        
        if (response.ok) {
          return;
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
      } catch (error) {
        retries++;
        
        if (retries > this.config.maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * retries));
      }
    }
  }
  
  private setupAutoFlush(): void {
    this.flushTimer = window.setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }
  
  private setupErrorTracking(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.trackError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(new Error(event.reason), {
        type: 'unhandled_rejection'
      });
    });
  }
  
  private setupPerformanceTracking(): void {
    // Track page load performance
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (perfData) {
        this.trackPerformance({
          loadTime: perfData.loadEventEnd - perfData.fetchStart,
          networkLatency: perfData.responseStart - perfData.requestStart
        });
      }
    });
    
    // Track FPS and frame time
    let frameCount = 0;
    let lastTime = performance.now();
    
    const trackFrame = (_currentTime: number) => {
      frameCount++;
      
      if (_currentTime - lastTime >= 1000) {
        this.performanceMetrics.fps = frameCount;
        this.performanceMetrics.frameTime = 1000 / frameCount;
        
        frameCount = 0;
        lastTime = _currentTime;
        
        // Track performance every 5 seconds
        if (Math.random() < 0.2) {
          this.trackPerformance({
            fps: this.performanceMetrics.fps,
            frameTime: this.performanceMetrics.frameTime
          });
        }
      }
      
      requestAnimationFrame(trackFrame);
    };
    
    requestAnimationFrame(trackFrame);
    
    // Track memory usage if available
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.performanceMetrics.memoryUsage = memory.usedJSHeapSize / (1024 * 1024);
      }, 5000);
    }
  }
  
  private setupVisibilityTracking(): void {
    let visibleTime = Date.now();
    let totalVisibleTime = 0;
    
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        totalVisibleTime += Date.now() - visibleTime;
        this.track('user.page_hidden', {
          visibleDuration: Date.now() - visibleTime,
          totalVisibleTime
        }, 'user');
      } else {
        visibleTime = Date.now();
        this.track('user.page_visible', {
          timestamp: Date.now()
        }, 'user');
      }
    });
    
    // Track on page unload
    window.addEventListener('beforeunload', () => {
      if (!document.hidden) {
        totalVisibleTime += Date.now() - visibleTime;
      }
      
      this.track('user.page_unload', {
        totalVisibleTime,
        sessionDuration: Date.now() - this.sessionStartTime
      }, 'user');
      
      // Synchronous final flush
      navigator.sendBeacon(
        this.config.endpoint,
        JSON.stringify({
          events: this.eventQueue,
          sessionId: this.sessionId,
          userId: this.userId,
          timestamp: Date.now()
        })
      );
    });
  }
  
  private async loadPersistedEvents(): Promise<void> {
    try {
      const stored = localStorage.getItem('telemetry_events');
      if (stored) {
        const events = JSON.parse(stored) as TelemetryEvent[];
        this.eventQueue.push(...events);
      }
    } catch (error) {
      logger.warn('Failed to load persisted telemetry events:', error as Record<string, any> | undefined);
    }
  }
  
  private persistEvents(): void {
    try {
      localStorage.setItem('telemetry_events', JSON.stringify(this.eventQueue));
    } catch (error) {
      logger.warn('Failed to persist telemetry events:', error as Record<string, any> | undefined);
    }
  }
}
