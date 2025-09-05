export interface PlatformInfo {
  os: "windows" | "macos" | "linux" | "ios" | "android" | "unknown";
  browser: "chrome" | "firefox" | "safari" | "edge" | "opera" | "unknown";
  device: "desktop" | "tablet" | "mobile" | "unknown";
  architecture: "x64" | "arm64" | "x86" | "arm" | "unknown";
  webgl: "webgl2" | "webgl1" | "none";
  webxr: boolean;
  touch: boolean;
  gamepad: boolean;
  pointerLock: boolean;
  fullscreen: boolean;
  webassembly: boolean;
  sharedArrayBuffer: boolean;
  offscreenCanvas: boolean;
  webWorkers: boolean;
  serviceWorkers: boolean;
  indexedDB: boolean;
  localStorage: boolean;
  webAudio: boolean;
  webRTC: boolean;
  clipboard: boolean;
  performance: "high" | "medium" | "low";
  memory: number; // MB
  cores: number;
  gpuTier: "high" | "medium" | "low" | "unknown";
}

export interface FeatureSupport {
  webgl2: boolean;
  webgl1: boolean;
  webxr: boolean;
  webgpu: boolean;
  sharedArrayBuffer: boolean;
  offscreenCanvas: boolean;
  webAssembly: boolean;
  webWorkers: boolean;
  serviceWorkers: boolean;
  webAudio: boolean;
  webRTC: boolean;
  fullscreen: boolean;
  pointerLock: boolean;
  gamepadAPI: boolean;
  touchEvents: boolean;
  accelerometer: boolean;
  gyroscope: boolean;
  clipboard: boolean;
  notifications: boolean;
  vibration: boolean;
  geolocation: boolean;
  camera: boolean;
  microphone: boolean;
}

export class PlatformDetection {
  private platformInfo: PlatformInfo;
  private featureSupport: FeatureSupport;
  private performanceBenchmark: number = 0;

  constructor() {
    this.platformInfo = this.detectPlatform();
    this.featureSupport = this.detectFeatures();
    this.runPerformanceBenchmark();
  }

  private detectPlatform(): PlatformInfo {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform?.toLowerCase() || "";

    return {
      os: this.detectOS(userAgent, platform),
      browser: this.detectBrowser(userAgent),
      device: this.detectDevice(userAgent),
      architecture: this.detectArchitecture(userAgent, platform),
      webgl: this.detectWebGL(),
      webxr: this.detectWebXR(),
      touch: this.detectTouch(),
      gamepad: this.detectGamepad(),
      pointerLock: this.detectPointerLock(),
      fullscreen: this.detectFullscreen(),
      webassembly: this.detectWebAssembly(),
      sharedArrayBuffer: this.detectSharedArrayBuffer(),
      offscreenCanvas: this.detectOffscreenCanvas(),
      webWorkers: this.detectWebWorkers(),
      serviceWorkers: this.detectServiceWorkers(),
      indexedDB: this.detectIndexedDB(),
      localStorage: this.detectLocalStorage(),
      webAudio: this.detectWebAudio(),
      webRTC: this.detectWebRTC(),
      clipboard: this.detectClipboard(),
      performance: this.detectPerformanceLevel(),
      memory: this.detectMemory(),
      cores: this.detectCores(),
      gpuTier: this.detectGPUTier(),
    };
  }

  private detectOS(userAgent: string, platform: string): PlatformInfo["os"] {
    if (userAgent.includes("windows") || platform.includes("win")) {return "windows";}
    if (userAgent.includes("macintosh") || userAgent.includes("mac os") || platform.includes("mac"))
      {return "macos";}
    if (userAgent.includes("linux") || platform.includes("linux")) {return "linux";}
    if (userAgent.includes("iphone") || userAgent.includes("ipad") || userAgent.includes("ipod"))
      {return "ios";}
    if (userAgent.includes("android")) {return "android";}
    return "unknown";
  }

  private detectBrowser(userAgent: string): PlatformInfo["browser"] {
    if (userAgent.includes("edg/")) {return "edge";}
    if (userAgent.includes("chrome") && !userAgent.includes("chromium")) {return "chrome";}
    if (userAgent.includes("firefox")) {return "firefox";}
    if (userAgent.includes("safari") && !userAgent.includes("chrome")) {return "safari";}
    if (userAgent.includes("opera") || userAgent.includes("opr/")) {return "opera";}
    return "unknown";
  }

  private detectDevice(userAgent: string): PlatformInfo["device"] {
    if (userAgent.includes("mobile") || userAgent.includes("phone")) {return "mobile";}
    if (userAgent.includes("tablet") || userAgent.includes("ipad")) {return "tablet";}
    return "desktop";
  }

  private detectArchitecture(userAgent: string, platform: string): PlatformInfo["architecture"] {
    if (userAgent.includes("arm64") || userAgent.includes("aarch64")) {return "arm64";}
    if (userAgent.includes("arm")) {return "arm";}
    if (userAgent.includes("x86_64") || userAgent.includes("x64") || platform.includes("64"))
      {return "x64";}
    if (userAgent.includes("x86") || userAgent.includes("i386") || userAgent.includes("i686"))
      {return "x86";}
    return "unknown";
  }

  private detectWebGL(): PlatformInfo["webgl"] {
    try {
      const canvas = document.createElement("canvas");
      const gl2 = canvas.getContext("webgl2");
      if (gl2) {return "webgl2";}

      const gl1 = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl1) {return "webgl1";}

      return "none";
    } catch {
      return "none";
    }
  }

  private detectWebXR(): boolean {
    return "xr" in navigator && "isSessionSupported" in (navigator as any).xr;
  }

  private detectTouch(): boolean {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  private detectGamepad(): boolean {
    return "getGamepads" in navigator;
  }

  private detectPointerLock(): boolean {
    return "requestPointerLock" in document.documentElement;
  }

  private detectFullscreen(): boolean {
    return (
      "requestFullscreen" in document.documentElement ||
      "webkitRequestFullscreen" in document.documentElement ||
      "mozRequestFullScreen" in document.documentElement
    );
  }

  private detectWebAssembly(): boolean {
    return typeof WebAssembly === "object";
  }

  private detectSharedArrayBuffer(): boolean {
    return typeof SharedArrayBuffer !== "undefined";
  }

  private detectOffscreenCanvas(): boolean {
    return typeof OffscreenCanvas !== "undefined";
  }

  private detectWebWorkers(): boolean {
    return typeof Worker !== "undefined";
  }

  private detectServiceWorkers(): boolean {
    return "serviceWorker" in navigator;
  }

  private detectIndexedDB(): boolean {
    return "indexedDB" in window;
  }

  private detectLocalStorage(): boolean {
    try {
      return typeof localStorage !== "undefined";
    } catch {
      return false;
    }
  }

  private detectWebAudio(): boolean {
    return (
      typeof AudioContext !== "undefined" ||
      typeof (window as any).webkitAudioContext !== "undefined"
    );
  }

  private detectWebRTC(): boolean {
    return typeof RTCPeerConnection !== "undefined";
  }

  private detectClipboard(): boolean {
    return "clipboard" in navigator;
  }

  private detectPerformanceLevel(): PlatformInfo["performance"] {
    const memory = this.detectMemory();
    const cores = this.detectCores();

    if (memory >= 8192 && cores >= 8) {return "high";}
    if (memory >= 4096 && cores >= 4) {return "medium";}
    return "low";
  }

  private detectMemory(): number {
    // @ts-expect-error - deviceMemory is experimental
    return (navigator as any).deviceMemory ? (navigator as any).deviceMemory * 1024 : 4096;
  }

  private detectCores(): number {
    return navigator.hardwareConcurrency || 4;
  }

  private detectGPUTier(): PlatformInfo["gpuTier"] {
    // This would need WebGL renderer info or GPU benchmarking
    // For now, estimate based on other factors
    const webgl = this.detectWebGL();
    const performance = this.detectPerformanceLevel();

    if (webgl === "webgl2" && performance === "high") {return "high";}
    if (webgl === "webgl2" && performance === "medium") {return "medium";}
    if (webgl === "webgl1") {return "low";}
    return "unknown";
  }

  private detectFeatures(): FeatureSupport {
    return {
      webgl2: this.platformInfo.webgl === "webgl2",
      webgl1: this.platformInfo.webgl !== "none",
      webxr: this.platformInfo.webxr,
      webgpu: "gpu" in navigator,
      sharedArrayBuffer: this.platformInfo.sharedArrayBuffer,
      offscreenCanvas: this.platformInfo.offscreenCanvas,
      webAssembly: this.platformInfo.webassembly,
      webWorkers: this.platformInfo.webWorkers,
      serviceWorkers: this.platformInfo.serviceWorkers,
      webAudio: this.platformInfo.webAudio,
      webRTC: this.platformInfo.webRTC,
      fullscreen: this.platformInfo.fullscreen,
      pointerLock: this.platformInfo.pointerLock,
      gamepadAPI: this.platformInfo.gamepad,
      touchEvents: this.platformInfo.touch,
      accelerometer: "DeviceMotionEvent" in window,
      gyroscope: "DeviceOrientationEvent" in window,
      clipboard: this.platformInfo.clipboard,
      notifications: "Notification" in window,
      vibration: "vibrate" in navigator,
      geolocation: "geolocation" in navigator,
      camera: "mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices,
      microphone: "mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices,
    };
  }

  private async runPerformanceBenchmark(): Promise<void> {
    try {
      const start = performance.now();

      // Simple computational benchmark
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i);
      }

      const computeTime = performance.now() - start;

      // WebGL benchmark if available
      let renderTime = 0;
      if (this.platformInfo.webgl !== "none") {
        renderTime = await this.runWebGLBenchmark();
      }

      this.performanceBenchmark = Math.max(1, 100 - computeTime - renderTime);
    } catch (_error) {
      this.performanceBenchmark = 50; // Default fallback
    }
  }

  private async runWebGLBenchmark(): Promise<number> {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;

      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) {return 0;}

      const start = performance.now();

      // Simple render test
      gl.clearColor(0, 0, 0, 1);
      for (let i = 0; i < 100; i++) {
        gl.clear(gl.COLOR_BUFFER_BIT);
      }

      gl.finish();
      return performance.now() - start;
    } catch {
      return 0;
    }
  }

  // Public API
  public getPlatformInfo(): PlatformInfo {
    return { ...this.platformInfo };
  }

  public getFeatureSupport(): FeatureSupport {
    return { ...this.featureSupport };
  }

  public getPerformanceBenchmark(): number {
    return this.performanceBenchmark;
  }

  public isFeatureSupported(feature: keyof FeatureSupport): boolean {
    return this.featureSupport[feature];
  }

  public isMobile(): boolean {
    return this.platformInfo.device === "mobile";
  }

  public isTablet(): boolean {
    return this.platformInfo.device === "tablet";
  }

  public isDesktop(): boolean {
    return this.platformInfo.device === "desktop";
  }

  public isTouchDevice(): boolean {
    return this.platformInfo.touch;
  }

  public isHighPerformance(): boolean {
    return this.platformInfo.performance === "high";
  }

  public canRunAdvancedFeatures(): boolean {
    return (
      this.featureSupport.webgl2 &&
      this.featureSupport.webAssembly &&
      this.featureSupport.webWorkers &&
      this.platformInfo.performance !== "low"
    );
  }

  public getRecommendedSettings(): any {
    const settings: any = {
      graphics: {
        quality: this.platformInfo.performance,
        shadows: this.platformInfo.performance !== "low",
        antialiasing: this.platformInfo.performance === "high",
        postProcessing: this.platformInfo.performance === "high",
        particleCount:
          this.platformInfo.performance === "high"
            ? 1000
            : this.platformInfo.performance === "medium"
              ? 500
              : 250,
      },
      audio: {
        enabled: this.featureSupport.webAudio,
        spatialAudio: this.featureSupport.webAudio && this.platformInfo.performance !== "low",
        compression: this.platformInfo.performance === "low",
      },
      networking: {
        webRTC: this.featureSupport.webRTC,
        compression: this.platformInfo.performance === "low",
        bufferSize: this.platformInfo.memory >= 4096 ? "large" : "small",
      },
      input: {
        touch: this.isTouchDevice(),
        gamepad: this.featureSupport.gamepadAPI,
        pointerLock: this.featureSupport.pointerLock && this.isDesktop(),
      },
      storage: {
        indexedDB: this.featureSupport.indexedDB,
        localStorage: this.platformInfo.localStorage,
        cacheSize: this.platformInfo.memory >= 8192 ? 500 : 250, // MB
      },
    };

    return settings;
  }

  public generateCompatibilityReport(): string {
    const info = this.getPlatformInfo();
    const features = this.getFeatureSupport();

    let report = `Platform Compatibility Report\n`;
    report += `==============================\n\n`;

    report += `System Information:\n`;
    report += `- OS: ${info.os} (${info.architecture})\n`;
    report += `- Browser: ${info.browser}\n`;
    report += `- Device: ${info.device}\n`;
    report += `- Performance: ${info.performance}\n`;
    report += `- Memory: ${info.memory}MB\n`;
    report += `- CPU Cores: ${info.cores}\n`;
    report += `- GPU Tier: ${info.gpuTier}\n\n`;

    report += `Graphics Support:\n`;
    report += `- WebGL 2.0: ${features.webgl2 ? "✓" : "✗"}\n`;
    report += `- WebGL 1.0: ${features.webgl1 ? "✓" : "✗"}\n`;
    report += `- WebGPU: ${features.webgpu ? "✓" : "✗"}\n`;
    report += `- WebXR: ${features.webxr ? "✓" : "✗"}\n\n`;

    report += `Core Features:\n`;
    report += `- WebAssembly: ${features.webAssembly ? "✓" : "✗"}\n`;
    report += `- Web Workers: ${features.webWorkers ? "✓" : "✗"}\n`;
    report += `- Shared Array Buffer: ${features.sharedArrayBuffer ? "✓" : "✗"}\n`;
    report += `- Offscreen Canvas: ${features.offscreenCanvas ? "✓" : "✗"}\n\n`;

    report += `Input Support:\n`;
    report += `- Touch: ${features.touchEvents ? "✓" : "✗"}\n`;
    report += `- Gamepad: ${features.gamepadAPI ? "✓" : "✗"}\n`;
    report += `- Pointer Lock: ${features.pointerLock ? "✓" : "✗"}\n`;
    report += `- Fullscreen: ${features.fullscreen ? "✓" : "✗"}\n\n`;

    report += `Media Support:\n`;
    report += `- Web Audio: ${features.webAudio ? "✓" : "✗"}\n`;
    report += `- WebRTC: ${features.webRTC ? "✓" : "✗"}\n`;
    report += `- Camera: ${features.camera ? "✓" : "✗"}\n`;
    report += `- Microphone: ${features.microphone ? "✓" : "✗"}\n\n`;

    report += `Performance Benchmark: ${this.performanceBenchmark.toFixed(1)}/100\n\n`;

    const canRun = this.canRunAdvancedFeatures();
    report += `Compatibility: ${canRun ? "FULL SUPPORT" : "LIMITED SUPPORT"}\n`;

    if (!canRun) {
      report += `\nLimitations:\n`;
      if (!features.webgl2) {report += `- Limited graphics capabilities (WebGL 1.0 only)\n`;}
      if (!features.webAssembly) {report += `- No WebAssembly support\n`;}
      if (!features.webWorkers) {report += `- No background processing support\n`;}
      if (info.performance === "low") {report += `- Low performance device\n`;}
    }

    return report;
  }
}
