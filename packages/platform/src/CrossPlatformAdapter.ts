import { PlatformDetection, PlatformInfo, FeatureSupport } from "./PlatformDetection";
import { logger } from "@vtt/logging";
import type { KeyboardEvent, MouseEvent } from "react";

export interface PlatformAdapter {
  init(): Promise<void>;
  dispose(): void;

  // Rendering
  createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas;
  getWebGLContext(
    canvas: HTMLCanvasElement | OffscreenCanvas,
  ): WebGLRenderingContext | WebGL2RenderingContext | null;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(id: number): void;

  // Input
  addInputListeners(element: HTMLElement): void;
  removeInputListeners(element: HTMLElement): void;
  getGamepads(): Gamepad[];
  requestPointerLock(element: HTMLElement): Promise<void>;
  exitPointerLock(): void;

  // Fullscreen
  requestFullscreen(element: HTMLElement): Promise<void>;
  exitFullscreen(): Promise<void>;
  isFullscreen(): boolean;

  // Storage
  getStorage(type: "local" | "session" | "indexed"): Storage | IDBFactory | null;

  // Audio
  createAudioContext(): AudioContext | null;

  // Network
  createWebSocket(url: string): WebSocket;
  createRTCConnection(config?: RTCConfiguration): RTCPeerConnection | null;

  // Performance
  getPerformanceMetrics(): PerformanceMetrics;

  // Device capabilities
  requestDeviceAccess(type: "camera" | "microphone" | "geolocation"): Promise<any>;

  // Notifications
  requestNotificationPermission(): Promise<NotificationPermission>;
  showNotification(title: string, options?: NotificationOptions): Notification | null;

  // Clipboard
  readFromClipboard(): Promise<string>;
  writeToClipboard(text: string): Promise<void>;

  // Vibration (mobile)
  vibrate(pattern: number | number[]): boolean;
}

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  cpuUsage: number;
  batteryLevel?: number;
  thermalState?: "nominal" | "fair" | "serious" | "critical";
}

export interface AdaptiveSettings {
  graphics: {
    quality: "low" | "medium" | "high";
    renderScale: number;
    shadowQuality: "off" | "low" | "medium" | "high";
    antialiasing: boolean;
    postProcessing: boolean;
    maxParticles: number;
    maxLights: number;
    lodBias: number;
  };
  audio: {
    enabled: boolean;
    quality: "low" | "medium" | "high";
    spatialAudio: boolean;
    maxSources: number;
    compression: boolean;
  };
  network: {
    maxConnections: number;
    bufferSize: number;
    compression: boolean;
    prioritization: boolean;
  };
  input: {
    touchEnabled: boolean;
    gamepadEnabled: boolean;
    keyboardEnabled: boolean;
    mouseEnabled: boolean;
    gestureEnabled: boolean;
  };
  storage: {
    cacheSize: number; // MB
    offlineMode: boolean;
    syncEnabled: boolean;
  };
}

export class CrossPlatformAdapter implements PlatformAdapter {
  private platformDetection: PlatformDetection;
  private platformInfo: PlatformInfo;
  private featureSupport: FeatureSupport;
  private adaptiveSettings: AdaptiveSettings;
  private performanceMonitor: PerformanceMonitor;

  // Input handling
  private inputListeners = new Map<HTMLElement, InputEventListeners>();
  private gamepadConnected = false;
  private pointerLocked = false;

  // Audio context
  private audioContext: AudioContext | null = null;

  // Storage instances
  private indexedDB: IDBFactory | null = null;

  constructor() {
    this.platformDetection = new PlatformDetection();
    this.platformInfo = this.platformDetection.getPlatformInfo();
    this.featureSupport = this.platformDetection.getFeatureSupport();
    this.adaptiveSettings = this.generateAdaptiveSettings();
    this.performanceMonitor = new PerformanceMonitor();
  }

  public async init(): Promise<void> {
    // Initialize platform-specific features
    await this.initializeFeatures();

    // Setup performance monitoring
    this.performanceMonitor.start();

    // Setup gamepad monitoring
    if (this.featureSupport.gamepadAPI) {
      this.setupGamepadMonitoring();
    }

    // Setup visibility change handling
    this.setupVisibilityHandling();

    // Setup resize handling
    this.setupResizeHandling();

    logger.info(
      "CrossPlatformAdapter initialized:",
      this.platformInfo.os,
      this.platformInfo.browser,
    );
  }

  public dispose(): void {
    this.performanceMonitor.stop();

    // Clean up audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Clean up input listeners
    for (const [element, _listeners] of this.inputListeners) {
      this.removeInputListeners(element);
    }

    logger.info("CrossPlatformAdapter disposed");
  }

  private async initializeFeatures(): Promise<void> {
    // Initialize IndexedDB if supported
    if (this.featureSupport.indexedDB) {
      this.indexedDB = window.indexedDB;
    }

    // Request permissions for supported features
    if (this.featureSupport.notifications) {
      await this.requestNotificationPermission();
    }

    // Initialize audio context on user interaction
    if (this.featureSupport.webAudio) {
      document.addEventListener("click", this.initAudioContext.bind(this), { once: true });
      document.addEventListener("touchstart", this.initAudioContext.bind(this), { once: true });
    }
  }

  private initAudioContext(): void {
    if (!this.audioContext && this.featureSupport.webAudio) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private generateAdaptiveSettings(): AdaptiveSettings {
    const recommended = this.platformDetection.getRecommendedSettings();

    return {
      graphics: {
        quality: recommended.graphics.quality,
        renderScale: this.platformInfo.device === "mobile" ? 0.8 : 1.0,
        shadowQuality: recommended.graphics.shadows ? "medium" : "off",
        antialiasing: recommended.graphics.antialiasing,
        postProcessing: recommended.graphics.postProcessing,
        maxParticles: recommended.graphics.particleCount,
        maxLights: this.platformInfo.performance === "high" ? 16 : 8,
        lodBias: this.platformInfo.performance === "low" ? 2.0 : 1.0,
      },
      audio: {
        enabled: recommended.audio.enabled,
        quality: this.platformInfo.performance,
        spatialAudio: recommended.audio.spatialAudio,
        maxSources: this.platformInfo.performance === "high" ? 32 : 16,
        compression: recommended.audio.compression,
      },
      network: {
        maxConnections: this.platformInfo.device === "mobile" ? 4 : 8,
        bufferSize: this.platformInfo.memory >= 4096 ? 64 : 32,
        compression: this.platformInfo.performance === "low",
        prioritization: true,
      },
      input: {
        touchEnabled: this.featureSupport.touchEvents,
        gamepadEnabled: this.featureSupport.gamepadAPI,
        keyboardEnabled: this.platformInfo.device === "desktop",
        mouseEnabled: this.platformInfo.device === "desktop",
        gestureEnabled: this.platformInfo.device !== "desktop",
      },
      storage: {
        cacheSize: recommended.storage.cacheSize,
        offlineMode: this.featureSupport.serviceWorkers,
        syncEnabled: this.featureSupport.indexedDB,
      },
    };
  }

  // Rendering methods
  public createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
    if (this.featureSupport.offscreenCanvas && typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(width, height);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  public getWebGLContext(
    canvas: HTMLCanvasElement | OffscreenCanvas,
  ): WebGLRenderingContext | WebGL2RenderingContext | null {
    const contextOptions = {
      alpha: false,
      antialias: this.adaptiveSettings.graphics.antialiasing,
      depth: true,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference:
        this.platformInfo.performance === "high"
          ? ("high-performance" as const)
          : ("default" as const),
    };

    if (this.featureSupport.webgl2) {
      const context = canvas.getContext("webgl2", contextOptions);
      if (context) {return context;}
    }

    if (this.featureSupport.webgl1) {
      return (
        canvas.getContext("webgl", contextOptions) ||
        canvas.getContext("experimental-webgl", contextOptions)
      );
    }

    return null;
  }

  public requestAnimationFrame(callback: FrameRequestCallback): number {
    return requestAnimationFrame(callback);
  }

  public cancelAnimationFrame(id: number): void {
    cancelAnimationFrame(id);
  }

  // Input methods
  public addInputListeners(element: HTMLElement): void {
    if (this.inputListeners.has(element)) {return;}

    const listeners = new InputEventListeners(element, this.adaptiveSettings.input);
    this.inputListeners.set(element, listeners);
  }

  public removeInputListeners(element: HTMLElement): void {
    const listeners = this.inputListeners.get(element);
    if (listeners) {
      listeners.dispose();
      this.inputListeners.delete(element);
    }
  }

  public getGamepads(): Gamepad[] {
    if (!this.featureSupport.gamepadAPI) {return [];}

    const gamepads = navigator.getGamepads();
    return Array.from(gamepads).filter((gamepad): gamepad is Gamepad => gamepad !== null);
  }

  public async requestPointerLock(element: HTMLElement): Promise<void> {
    if (!this.featureSupport.pointerLock) {
      throw new Error("Pointer lock not supported");
    }

    return new Promise((_resolve, __reject) => {
      const onLockChange = () => {
        if (document.pointerLockElement === element) {
          this.pointerLocked = true;
          document.removeEventListener("pointerlockchange", onLockChange);
          resolve();
        }
      };

      const onLockError = () => {
        document.removeEventListener("pointerlockerror", onLockError);
        reject(new Error("Pointer lock failed"));
      };

      document.addEventListener("pointerlockchange", onLockChange);
      document.addEventListener("pointerlockerror", onLockError);

      element.requestPointerLock();
    });
  }

  public exitPointerLock(): void {
    if (this.pointerLocked) {
      document.exitPointerLock();
      this.pointerLocked = false;
    }
  }

  // Fullscreen methods
  public async requestFullscreen(element: HTMLElement): Promise<void> {
    if (!this.featureSupport.fullscreen) {
      throw new Error("Fullscreen not supported");
    }

    const requestFS =
      element.requestFullscreen ||
      (element as any).webkitRequestFullscreen ||
      (element as any).mozRequestFullScreen;

    if (requestFS) {
      return requestFS.call(element);
    }

    throw new Error("Fullscreen method not available");
  }

  public async exitFullscreen(): Promise<void> {
    const exitFS =
      document.exitFullscreen ||
      (document as any).webkitExitFullscreen ||
      (document as any).mozCancelFullScreen;

    if (exitFS) {
      return exitFS.call(document);
    }
  }

  public isFullscreen(): boolean {
    return !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement
    );
  }

  // Storage methods
  public getStorage(type: "local" | "session" | "indexed"): Storage | IDBFactory | null {
    switch (type) {
      case "local":
        return this.platformInfo.localStorage ? localStorage : null;
      case "session":
        return typeof sessionStorage !== "undefined" ? sessionStorage : null;
      case "indexed":
        return this.indexedDB;
      default:
        return null;
    }
  }

  // Audio methods
  public createAudioContext(): AudioContext | null {
    if (!this.audioContext) {
      this.initAudioContext();
    }
    return this.audioContext;
  }

  // Network methods
  public createWebSocket(url: string): WebSocket {
    return new WebSocket(url);
  }

  public createRTCConnection(config?: RTCConfiguration): RTCPeerConnection | null {
    if (!this.featureSupport.webRTC) {return null;}

    return new RTCPeerConnection(config);
  }

  // Performance methods
  public getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMonitor.getMetrics();
  }

  // Device access methods
  public async requestDeviceAccess(type: "camera" | "microphone" | "geolocation"): Promise<any> {
    switch (type) {
      case "camera":
        if (!this.featureSupport.camera) {throw new Error("Camera not supported");}
        return navigator.mediaDevices.getUserMedia({ video: true });

      case "microphone":
        if (!this.featureSupport.microphone) {throw new Error("Microphone not supported");}
        return navigator.mediaDevices.getUserMedia({ audio: true });

      case "geolocation":
        if (!this.featureSupport.geolocation) {throw new Error("Geolocation not supported");}
        return new Promise((_resolve, __reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });

      default:
        throw new Error(`Unknown device type: ${type}`);
    }
  }

  // Notification methods
  public async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!this.featureSupport.notifications) {
      return "denied";
    }

    return Notification.requestPermission();
  }

  public showNotification(title: string, options?: NotificationOptions): Notification | null {
    if (!this.featureSupport.notifications || Notification.permission !== "granted") {
      return null;
    }

    return new Notification(title, options);
  }

  // Clipboard methods
  public async readFromClipboard(): Promise<string> {
    if (!this.featureSupport.clipboard) {
      throw new Error("Clipboard access not supported");
    }

    return navigator.clipboard.readText();
  }

  public async writeToClipboard(text: string): Promise<void> {
    if (!this.featureSupport.clipboard) {
      throw new Error("Clipboard access not supported");
    }

    return navigator.clipboard.writeText(text);
  }

  // Vibration methods
  public vibrate(pattern: number | number[]): boolean {
    if (!this.featureSupport.vibration) {return false;}

    return navigator.vibrate(pattern);
  }

  // Event setup methods
  private setupGamepadMonitoring(): void {
    window.addEventListener("gamepadconnected", (event) => {
      logger.info("Gamepad connected:", event.gamepad.id);
      this.gamepadConnected = true;
    });

    window.addEventListener("gamepaddisconnected", (event) => {
      logger.info("Gamepad disconnected:", event.gamepad.id);
      this.gamepadConnected = false;
    });
  }

  private setupVisibilityHandling(): void {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // Pause performance monitoring and reduce activity
        this.performanceMonitor.pause();
      } else {
        // Resume performance monitoring
        this.performanceMonitor.resume();
      }
    });
  }

  private setupResizeHandling(): void {
    window.addEventListener("resize", () => {
      // Update adaptive settings based on new window size
      this.updateAdaptiveSettings();
    });

    // Handle orientation change on mobile
    if (this.platformInfo.device !== "desktop") {
      window.addEventListener("orientationchange", () => {
        setTimeout(() => this.updateAdaptiveSettings(), 100);
      });
    }
  }

  private updateAdaptiveSettings(): void {
    // Adjust render scale based on window size
    const pixelRatio = window.devicePixelRatio || 1;
    const screenArea = window.innerWidth * window.innerHeight;

    if (screenArea < 500000) {
      // Small screen
      this.adaptiveSettings.graphics.renderScale = 0.7;
    } else if (screenArea < 2000000) {
      // Medium screen
      this.adaptiveSettings.graphics.renderScale = 0.9;
    } else {
      // Large screen
      this.adaptiveSettings.graphics.renderScale = Math.min(1.0, 2.0 / pixelRatio);
    }
  }

  // Public getters
  public getPlatformInfo(): PlatformInfo {
    return this.platformInfo;
  }

  public getFeatureSupport(): FeatureSupport {
    return this.featureSupport;
  }

  public getAdaptiveSettings(): AdaptiveSettings {
    return { ...this.adaptiveSettings };
  }

  public updateSettings(settings: Partial<AdaptiveSettings>): void {
    this.adaptiveSettings = { ...this.adaptiveSettings, ...settings };
  }
}

// Helper classes
class InputEventListeners {
  private element: HTMLElement;
  private settings: AdaptiveSettings["input"];
  private listeners: { [key: string]: EventListener } = {};

  constructor(element: HTMLElement, settings: AdaptiveSettings["input"]) {
    this.element = element;
    this.settings = settings;
    this.setupListeners();
  }

  private setupListeners(): void {
    if (this.settings.keyboardEnabled) {
      this.listeners.keydown = this.onKeyDown.bind(this);
      this.listeners.keyup = this.onKeyUp.bind(this);
      document.addEventListener("keydown", this.listeners.keydown);
      document.addEventListener("keyup", this.listeners.keyup);
    }

    if (this.settings.mouseEnabled) {
      this.listeners.mousedown = this.onMouseDown.bind(this);
      this.listeners.mouseup = this.onMouseUp.bind(this);
      this.listeners.mousemove = this.onMouseMove.bind(this);
      this.listeners.wheel = this.onWheel.bind(this);

      this.element.addEventListener("mousedown", this.listeners.mousedown);
      this.element.addEventListener("mouseup", this.listeners.mouseup);
      this.element.addEventListener("mousemove", this.listeners.mousemove);
      this.element.addEventListener("wheel", this.listeners.wheel);
    }

    if (this.settings.touchEnabled) {
      this.listeners.touchstart = this.onTouchStart.bind(this);
      this.listeners.touchend = this.onTouchEnd.bind(this);
      this.listeners.touchmove = this.onTouchMove.bind(this);

      this.element.addEventListener("touchstart", this.listeners.touchstart, { passive: false });
      this.element.addEventListener("touchend", this.listeners.touchend, { passive: false });
      this.element.addEventListener("touchmove", this.listeners.touchmove, { passive: false });
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Dispatch custom input event
    this.element.dispatchEvent(
      new CustomEvent("platformInput", {
        detail: { type: "keydown", event },
      }),
    );
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.element.dispatchEvent(
      new CustomEvent("platformInput", {
        detail: { type: "keyup", event },
      }),
    );
  }

  private onMouseDown(event: MouseEvent): void {
    this.element.dispatchEvent(
      new CustomEvent("platformInput", {
        detail: { type: "mousedown", event },
      }),
    );
  }

  private onMouseUp(event: MouseEvent): void {
    this.element.dispatchEvent(
      new CustomEvent("platformInput", {
        detail: { type: "mouseup", event },
      }),
    );
  }

  private onMouseMove(event: MouseEvent): void {
    this.element.dispatchEvent(
      new CustomEvent("platformInput", {
        detail: { type: "mousemove", event },
      }),
    );
  }

  private onWheel(event: WheelEvent): void {
    this.element.dispatchEvent(
      new CustomEvent("platformInput", {
        detail: { type: "wheel", event },
      }),
    );
  }

  private onTouchStart(event: TouchEvent): void {
    event.preventDefault();
    this.element.dispatchEvent(
      new CustomEvent("platformInput", {
        detail: { type: "touchstart", event },
      }),
    );
  }

  private onTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    this.element.dispatchEvent(
      new CustomEvent("platformInput", {
        detail: { type: "touchend", event },
      }),
    );
  }

  private onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    this.element.dispatchEvent(
      new CustomEvent("platformInput", {
        detail: { type: "touchmove", event },
      }),
    );
  }

  public dispose(): void {
    for (const [eventType, listener] of Object.entries(this.listeners)) {
      if (eventType.startsWith("key")) {
        document.removeEventListener(eventType, listener);
      } else {
        this.element.removeEventListener(eventType, listener);
      }
    }
    this.listeners = {};
  }
}

class PerformanceMonitor {
  private isRunning = false;
  private isPaused = false;
  private lastTime = 0;
  private frameCount = 0;
  private fps = 60;
  private frameTime = 16.67;
  private memoryUsage = 0;
  private intervalId?: number;

  public start(): void {
    if (this.isRunning) {return;}

    this.isRunning = true;
    this.lastTime = performance.now();
    this.intervalId = window.setInterval(() => this.updateMetrics(), 1000);
    this.requestFrame();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
    this.lastTime = performance.now();
    this.frameCount = 0;
  }

  private requestFrame(): void {
    if (!this.isRunning) {return;}

    requestAnimationFrame((_currentTime) => {
      if (!this.isPaused) {
        this.frameTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        this.frameCount++;
      }

      this.requestFrame();
    });
  }

  private updateMetrics(): void {
    if (this.isPaused) {return;}

    this.fps = this.frameCount;
    this.frameCount = 0;

    // Update memory usage if available
    if ("memory" in performance) {
      const memory = (performance as any).memory;
      this.memoryUsage = memory.usedJSHeapSize / (1024 * 1024); // MB
    }
  }

  public getMetrics(): PerformanceMetrics {
    return {
      fps: this.fps,
      frameTime: this.frameTime,
      memoryUsage: this.memoryUsage,
      cpuUsage: Math.min(100, Math.max(0, ((this.frameTime - 16.67) / 16.67) * 100)),
      batteryLevel: this.getBatteryLevel(),
      thermalState: this.getThermalState(),
    };
  }

  private getBatteryLevel(): number | undefined {
    // @ts-expect-error - Battery API is experimental
    const battery = (navigator as any).battery;
    return battery?.level;
  }

  private getThermalState(): PerformanceMetrics["thermalState"] {
    // Estimate based on performance
    if (this.frameTime > 50) {return "critical";}
    if (this.frameTime > 33) {return "serious";}
    if (this.frameTime > 20) {return "fair";}
    return "nominal";
  }
}
