import { logger } from "@vtt/logging";

export interface PerformanceMetrics {
  frameTime: number;
  fps: number;
  drawCalls: number;
  triangles: number;
  vertices: number;
  textureMemory: number;
  bufferMemory: number;
  shaderSwitches: number;
  cullTime: number;
  renderTime: number;
  gpuTime: number;
}

export interface PerformanceThresholds {
  minFPS: number;
  maxFrameTime: number;
  maxDrawCalls: number;
  maxTriangles: number;
  maxTextureMemory: number;
  maxBufferMemory: number;
}

export interface PerformanceProfile {
  name: string;
  thresholds: PerformanceThresholds;
  lodQuality: number;
  shadowQuality: number;
  effectsQuality: number;
  antiAliasing: boolean;
  anisotropicFiltering: number;
}

export interface GPUCapabilities {
  vendor: string;
  renderer: string;
  maxTextureSize: number;
  maxViewportSize: number;
  maxVertexAttribs: number;
  maxVaryingVectors: number;
  maxFragmentUniforms: number;
  maxVertexUniforms: number;
  maxTextureImageUnits: number;
  extensions: string[];
  webgl2Support: boolean;
  instancingSupport: boolean;
  vaoSupport: boolean;
  floatTextureSupport: boolean;
  depthTextureSupport: boolean;
}

export class PerformanceMonitor {
  private gl: WebGL2RenderingContext;
  private metrics: PerformanceMetrics;
  private previousMetrics: PerformanceMetrics;
  private frameHistory: number[] = [];
  private maxHistorySize = 60; // 1 second at 60fps

  // Timing
  private frameStartTime = 0;
  private lastFrameTime = 0;
  private gpuTimer: WebGLQuery | null = null;

  // Counters
  private frameCount = 0;
  private drawCallCount = 0;
  private triangleCount = 0;
  private vertexCount = 0;
  private shaderSwitchCount = 0;

  // Memory tracking
  private allocatedTextures = new Set<WebGLTexture>();
  private allocatedBuffers = new Set<WebGLBuffer>();
  private textureMemoryEstimate = 0;
  private bufferMemoryEstimate = 0;

  // Performance profiles
  private profiles = new Map<string, PerformanceProfile>();
  private currentProfile: PerformanceProfile;
  private autoProfileAdjustment = true;

  // GPU capabilities
  private capabilities: GPUCapabilities;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;

    // Initialize metrics
    this.metrics = this.createEmptyMetrics();
    this.previousMetrics = this.createEmptyMetrics();

    // Detect GPU capabilities
    this.capabilities = this.detectGPUCapabilities();

    // Initialize performance profiles
    this.initializeProfiles();
    this.currentProfile = this.profiles.get("medium")!;

    // Set up GPU timer if available
    if (this.capabilities.extensions.includes("EXT_disjoint_timer_query_webgl2")) {
      this.gpuTimer = this.gl.createQuery();
    }

    // Auto-detect best profile
    this.selectOptimalProfile();
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      frameTime: 0,
      fps: 0,
      drawCalls: 0,
      triangles: 0,
      vertices: 0,
      textureMemory: 0,
      bufferMemory: 0,
      shaderSwitches: 0,
      cullTime: 0,
      renderTime: 0,
      gpuTime: 0,
    };
  }

  private detectGPUCapabilities(): GPUCapabilities {
    const debugInfo = this.gl.getExtension("WEBGL_debug_renderer_info");
    const extensions = this.gl.getSupportedExtensions() || [];

    return {
      vendor: debugInfo ? this.gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : "Unknown",
      renderer: debugInfo ? this.gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "Unknown",
      maxTextureSize: this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE),
      maxViewportSize: this.gl.getParameter(this.gl.MAX_VIEWPORT_DIMS)[0],
      maxVertexAttribs: this.gl.getParameter(this.gl.MAX_VERTEX_ATTRIBS),
      maxVaryingVectors: this.gl.getParameter(this.gl.MAX_VARYING_VECTORS),
      maxFragmentUniforms: this.gl.getParameter(this.gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      maxVertexUniforms: this.gl.getParameter(this.gl.MAX_VERTEX_UNIFORM_VECTORS),
      maxTextureImageUnits: this.gl.getParameter(this.gl.MAX_TEXTURE_IMAGE_UNITS),
      extensions,
      webgl2Support: true,
      instancingSupport: extensions.includes("ANGLE_instanced_arrays"),
      vaoSupport: extensions.includes("OES_vertex_array_object"),
      floatTextureSupport: extensions.includes("OES_texture_float"),
      depthTextureSupport: extensions.includes("WEBGL_depth_texture"),
    };
  }

  private initializeProfiles(): void {
    // Low performance profile
    this.profiles.set("low", {
      name: "Low",
      thresholds: {
        minFPS: 30,
        maxFrameTime: 33.33,
        maxDrawCalls: 500,
        maxTriangles: 100000,
        maxTextureMemory: 64 * 1024 * 1024, // 64MB
        maxBufferMemory: 32 * 1024 * 1024, // 32MB
      },
      lodQuality: 0.3,
      shadowQuality: 0.5,
      effectsQuality: 0.3,
      antiAliasing: false,
      anisotropicFiltering: 1,
    });

    // Medium performance profile
    this.profiles.set("medium", {
      name: "Medium",
      thresholds: {
        minFPS: 45,
        maxFrameTime: 22.22,
        maxDrawCalls: 1000,
        maxTriangles: 500000,
        maxTextureMemory: 128 * 1024 * 1024, // 128MB
        maxBufferMemory: 64 * 1024 * 1024, // 64MB
      },
      lodQuality: 0.6,
      shadowQuality: 0.7,
      effectsQuality: 0.6,
      antiAliasing: true,
      anisotropicFiltering: 4,
    });

    // High performance profile
    this.profiles.set("high", {
      name: "High",
      thresholds: {
        minFPS: 60,
        maxFrameTime: 16.67,
        maxDrawCalls: 2000,
        maxTriangles: 1000000,
        maxTextureMemory: 256 * 1024 * 1024, // 256MB
        maxBufferMemory: 128 * 1024 * 1024, // 128MB
      },
      lodQuality: 0.8,
      shadowQuality: 0.9,
      effectsQuality: 0.8,
      antiAliasing: true,
      anisotropicFiltering: 8,
    });

    // Ultra performance profile
    this.profiles.set("ultra", {
      name: "Ultra",
      thresholds: {
        minFPS: 60,
        maxFrameTime: 16.67,
        maxDrawCalls: 5000,
        maxTriangles: 2000000,
        maxTextureMemory: 512 * 1024 * 1024, // 512MB
        maxBufferMemory: 256 * 1024 * 1024, // 256MB
      },
      lodQuality: 1.0,
      shadowQuality: 1.0,
      effectsQuality: 1.0,
      antiAliasing: true,
      anisotropicFiltering: 16,
    });
  }

  private selectOptimalProfile(): void {
    const renderer = this.capabilities.renderer.toLowerCase();
    const vendor = this.capabilities.vendor.toLowerCase();

    // Simple heuristic based on GPU info
    if (renderer.includes("integrated") || vendor.includes("intel")) {
      this.currentProfile = this.profiles.get("low")!;
    } else if (renderer.includes("geforce") || renderer.includes("radeon")) {
      if (renderer.includes("rtx") || renderer.includes("rx 6")) {
        this.currentProfile = this.profiles.get("high")!;
      } else {
        this.currentProfile = this.profiles.get("medium")!;
      }
    } else {
      this.currentProfile = this.profiles.get("medium")!;
    }
  }

  public beginFrame(): void {
    this.frameStartTime = performance.now();
    this.drawCallCount = 0;
    this.triangleCount = 0;
    this.vertexCount = 0;
    this.shaderSwitchCount = 0;

    // Begin GPU timing if available
    if (this.gpuTimer) {
      this.gl.beginQuery(this.gl.TIME_ELAPSED, this.gpuTimer);
    }
  }

  public endFrame(): void {
    const frameTime = performance.now() - this.frameStartTime;

    // End GPU timing
    if (this.gpuTimer) {
      this.gl.endQuery(this.gl.TIME_ELAPSED);

      // Check if result is available (from previous frame)
      const available = this.gl.getQueryParameter(this.gpuTimer, this.gl.QUERY_RESULT_AVAILABLE);
      if (available) {
        this.metrics.gpuTime =
          this.gl.getQueryParameter(this.gpuTimer, this.gl.QUERY_RESULT) / 1000000; // Convert to ms
      }
    }

    // Update metrics
    this.previousMetrics = { ...this.metrics };
    this.metrics.frameTime = frameTime;
    this.metrics.fps = 1000 / frameTime;
    this.metrics.drawCalls = this.drawCallCount;
    this.metrics.triangles = this.triangleCount;
    this.metrics.vertices = this.vertexCount;
    this.metrics.shaderSwitches = this.shaderSwitchCount;
    this.metrics.textureMemory = this.textureMemoryEstimate;
    this.metrics.bufferMemory = this.bufferMemoryEstimate;
    this.metrics.renderTime = frameTime - this.metrics.cullTime;

    // Update frame history
    this.frameHistory.push(frameTime);
    if (this.frameHistory.length > this.maxHistorySize) {
      this.frameHistory.shift();
    }

    this.frameCount++;
    this.lastFrameTime = frameTime;

    // Auto-adjust profile if enabled
    if (this.autoProfileAdjustment && this.frameCount % 60 === 0) {
      this.checkAndAdjustProfile();
    }
  }

  public recordDrawCall(triangles: number = 0, vertices: number = 0): void {
    this.drawCallCount++;
    this.triangleCount += triangles;
    this.vertexCount += vertices;
  }

  public recordShaderSwitch(): void {
    this.shaderSwitchCount++;
  }

  public recordCullTime(time: number): void {
    this.metrics.cullTime = time;
  }

  public recordTextureAllocation(texture: WebGLTexture, size: number): void {
    this.allocatedTextures.add(texture);
    this.textureMemoryEstimate += size;
  }

  public recordTextureDeallocation(texture: WebGLTexture, size: number): void {
    this.allocatedTextures.delete(texture);
    this.textureMemoryEstimate = Math.max(0, this.textureMemoryEstimate - size);
  }

  public recordBufferAllocation(buffer: WebGLBuffer, size: number): void {
    this.allocatedBuffers.add(buffer);
    this.bufferMemoryEstimate += size;
  }

  public recordBufferDeallocation(buffer: WebGLBuffer, size: number): void {
    this.allocatedBuffers.delete(buffer);
    this.bufferMemoryEstimate = Math.max(0, this.bufferMemoryEstimate - size);
  }

  private checkAndAdjustProfile(): void {
    const avgFPS = this.getAverageFPS();
    const avgFrameTime = this.getAverageFrameTime();
    const thresholds = this.currentProfile.thresholds;

    // Check if we need to downgrade
    if (avgFPS < thresholds.minFPS || avgFrameTime > thresholds.maxFrameTime) {
      const profileNames = ["ultra", "high", "medium", "low"];
      const currentIndex = profileNames.indexOf(this.getCurrentProfileName());

      if (currentIndex >= 0 && currentIndex < profileNames.length - 1) {
        const newProfile = profileNames[currentIndex + 1];
        if (newProfile) {
          this.setProfile(newProfile);
        }
        logger.info(`Performance: Downgraded to ${newProfile} profile`);
      }
    }
    // Check if we can upgrade
    else if (avgFPS > thresholds.minFPS * 1.2 && avgFrameTime < thresholds.maxFrameTime * 0.8) {
      const profileNames = ["low", "medium", "high", "ultra"];
      const currentIndex = profileNames.indexOf(this.getCurrentProfileName());

      if (currentIndex >= 0 && currentIndex < profileNames.length - 1) {
        const newProfile = profileNames[currentIndex + 1];
        if (newProfile) {
          this.setProfile(newProfile);
          logger.info(`Performance: Upgraded to ${newProfile} profile`);
        }
      }
    }
  }

  // Getters
  public getCurrentMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getPreviousMetrics(): PerformanceMetrics {
    return { ...this.previousMetrics };
  }

  public getAverageFPS(frames: number = this.frameHistory.length): number {
    if (this.frameHistory.length === 0) {return 0;}

    const recent = this.frameHistory.slice(-frames);
    const avgFrameTime = recent.reduce((_a, __b) => _a + __b, 0) / recent.length;
    return 1000 / avgFrameTime;
  }

  public getAverageFrameTime(frames: number = this.frameHistory.length): number {
    if (this.frameHistory.length === 0) {return 0;}

    const recent = this.frameHistory.slice(-frames);
    return recent.reduce((_a, __b) => _a + __b, 0) / recent.length;
  }

  public getFrameTimePercentile(percentile: number): number {
    if (this.frameHistory.length === 0) {return 0;}

    const sorted = [...this.frameHistory].sort((_a, __b) => _a - __b);
    const total = sorted.reduce((_a, __b) => _a + __b, 0);
    const index = Math.floor((percentile / 100) * (sorted.length - 1));
    return sorted[index] ?? 0;
  }

  public getCapabilities(): GPUCapabilities {
    return { ...this.capabilities };
  }

  public getCurrentProfile(): PerformanceProfile {
    return { ...this.currentProfile };
  }

  public getCurrentProfileName(): string {
    for (const [name, profile] of this.profiles) {
      if (profile === this.currentProfile) {
        return name;
      }
    }
    return "unknown";
  }

  public getAllProfiles(): Map<string, PerformanceProfile> {
    return new Map(this.profiles);
  }

  // Setters
  public setProfile(profileName: string): boolean {
    const profile = this.profiles.get(profileName);
    if (profile) {
      this.currentProfile = profile;
      return true;
    }
    return false;
  }

  public setAutoProfileAdjustment(enabled: boolean): void {
    this.autoProfileAdjustment = enabled;
  }

  public addCustomProfile(name: string, profile: PerformanceProfile): void {
    this.profiles.set(name, profile);
  }

  // Performance analysis
  public isPerformanceGood(): boolean {
    const thresholds = this.currentProfile.thresholds;
    return (
      this.metrics.fps >= thresholds.minFPS &&
      this.metrics.frameTime <= thresholds.maxFrameTime &&
      this.metrics.drawCalls <= thresholds.maxDrawCalls &&
      this.metrics.triangles <= thresholds.maxTriangles
    );
  }

  public getPerformanceIssues(): string[] {
    const issues: string[] = [];
    const thresholds = this.currentProfile.thresholds;

    if (this.metrics.fps < thresholds.minFPS) {
      issues.push(`Low FPS: ${this.metrics.fps.toFixed(1)} < ${thresholds.minFPS}`);
    }

    if (this.metrics.frameTime > thresholds.maxFrameTime) {
      issues.push(
        `High frame time: ${this.metrics.frameTime.toFixed(2)}ms > ${thresholds.maxFrameTime}ms`,
      );
    }

    if (this.metrics.drawCalls > thresholds.maxDrawCalls) {
      issues.push(`Too many draw calls: ${this.metrics.drawCalls} > ${thresholds.maxDrawCalls}`);
    }

    if (this.metrics.triangles > thresholds.maxTriangles) {
      issues.push(`Too many triangles: ${this.metrics.triangles} > ${thresholds.maxTriangles}`);
    }

    if (this.metrics.textureMemory > thresholds.maxTextureMemory) {
      issues.push(
        `High texture memory: ${(this.metrics.textureMemory / 1024 / 1024).toFixed(1)}MB > ${(thresholds.maxTextureMemory / 1024 / 1024).toFixed(1)}MB`,
      );
    }

    if (this.metrics.bufferMemory > thresholds.maxBufferMemory) {
      issues.push(
        `High buffer memory: ${(this.metrics.bufferMemory / 1024 / 1024).toFixed(1)}MB > ${(thresholds.maxBufferMemory / 1024 / 1024).toFixed(1)}MB`,
      );
    }

    return issues;
  }

  public getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const issues = this.getPerformanceIssues();

    if (issues.some((issue) => issue.includes("draw calls"))) {
      suggestions.push("Consider batching draw calls or using instanced rendering");
    }

    if (issues.some((issue) => issue.includes("triangles"))) {
      suggestions.push("Reduce geometry complexity or improve LOD system");
    }

    if (issues.some((issue) => issue.includes("texture memory"))) {
      suggestions.push("Compress textures or reduce texture sizes");
    }

    if (issues.some((issue) => issue.includes("frame time"))) {
      suggestions.push("Enable more aggressive culling or reduce shader complexity");
    }

    if (this.metrics.shaderSwitches > 100) {
      suggestions.push("Reduce shader switches by grouping objects by material");
    }

    return suggestions;
  }

  // Export/Import
  public exportMetrics(): any {
    return {
      currentMetrics: this.metrics,
      frameHistory: [...this.frameHistory],
      capabilities: this.capabilities,
      currentProfile: this.getCurrentProfileName(),
      timestamp: Date.now(),
    };
  }

  public getDetailedReport(): any {
    return {
      metrics: this.getCurrentMetrics(),
      averages: {
        fps: this.getAverageFPS(),
        frameTime: this.getAverageFrameTime(),
      },
      percentiles: {
        p50: this.getFrameTimePercentile(50),
        p90: this.getFrameTimePercentile(90),
        p99: this.getFrameTimePercentile(99),
      },
      profile: this.getCurrentProfile(),
      capabilities: this.getCapabilities(),
      issues: this.getPerformanceIssues(),
      suggestions: this.getOptimizationSuggestions(),
      memory: {
        textures: this.allocatedTextures.size,
        buffers: this.allocatedBuffers.size,
        textureMemoryMB: this.textureMemoryEstimate / 1024 / 1024,
        bufferMemoryMB: this.bufferMemoryEstimate / 1024 / 1024,
      },
    };
  }

  public dispose(): void {
    if (this.gpuTimer) {
      this.gl.deleteQuery(this.gpuTimer);
      this.gpuTimer = null;
    }

    this.frameHistory = [];
    this.allocatedTextures.clear();
    this.allocatedBuffers.clear();
  }
}
