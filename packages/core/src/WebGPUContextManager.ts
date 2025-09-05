/**
 * WebGPU Context Manager - Shared WebGPU context across renderer and physics systems
 * Provides centralized GPU device management and resource sharing
 */

import { EventEmitter } from "./EventEmitter";
import { logger } from "@vtt/logging";
// Use global WebGPU types
// import {
//   GPUDevice,
//   GPUAdapter,
//   GPUBuffer,
//   GPUTexture,
//   GPURenderPipeline,
//   GPUComputePipeline,
//   GPUBindGroup,
//   GPUCommandEncoder,
// } from "@webgpu/types";

// Import GPUTextureUsage as value, not type
declare const GPUTextureUsage: {
  readonly RENDER_ATTACHMENT: number;
  readonly TEXTURE_BINDING: number;
  readonly COPY_SRC: number;
  readonly COPY_DST: number;
};

import { GPUResourceManager, SystemEvent, Disposable } from "./SharedInterfaces";

export interface WebGPUContextConfig {
  powerPreference: "low-power" | "high-performance";
  forceFallbackAdapter: boolean;
  requiredFeatures: GPUFeatureName[];
  requiredLimits: Record<string, number>;
  enableDebug: boolean;
}

export interface WebGPUContextInfo {
  adapter: GPUAdapter;
  device: GPUDevice;
  queue: GPUCommandQueue;
  canvas?: HTMLCanvasElement;
  context?: GPUCanvasContext;
  limits: GPUSupportedLimits;
  features: GPUSupportedFeatures;
}

export interface SharedRenderTarget {
  id: string;
  texture: GPUTexture;
  view: GPUTextureView;
  format: GPUTextureFormat;
  width: number;
  height: number;
  usage: GPUTextureUsageFlags;
  label?: string;
}

export interface SharedBuffer {
  id: string;
  buffer: GPUBuffer;
  size: number;
  usage: GPUBufferUsageFlags;
  label?: string;
  mappedRange?: ArrayBuffer;
}

export interface ComputeJob {
  id: string;
  pipeline: GPUComputePipeline;
  bindGroups: GPUBindGroup[];
  workgroupSize: [number, number, number];
  label?: string;
  priority: number;
}

interface WebGPUContextEvents {
  ready: undefined;
  error: GPUError;
  devicelost: GPUDeviceLostInfo;
}

export class WebGPUContextManager extends EventEmitter<WebGPUContextEvents> implements Disposable {
  private config: WebGPUContextConfig;
  private contextInfo?: WebGPUContextInfo;
  private sharedBuffers = new Map<string, SharedBuffer>();
  private sharedTextures = new Map<string, SharedRenderTarget>();
  private computeJobs = new Map<string, ComputeJob>();
  private frameCallbacks = new Set<(_deltaTime: number) => void>();

  private isInitialized = false;
  private animationFrameId?: number;
  private lastFrameTime = 0;

  constructor(config: Partial<WebGPUContextConfig> = {}) {
    super();

    this.config = {
      powerPreference: "high-performance",
      forceFallbackAdapter: false,
      requiredFeatures: [],
      requiredLimits: {},
      enableDebug: false,
      ...config,
    };
  }

  /**
   * Initialize WebGPU context
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check WebGPU support
      if (!navigator.gpu) {
        throw new Error("WebGPU is not supported in this browser");
      }

      // Request adapter
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: this.config.powerPreference,
        forceFallbackAdapter: this.config.forceFallbackAdapter,
      });

      if (!adapter) {
        throw new Error("Failed to get WebGPU adapter");
      }

      // Check required features
      for (const feature of this.config.requiredFeatures) {
        if (!adapter.features.has(feature)) {
          throw new Error(`Required feature '${feature}' is not supported`);
        }
      }

      // Request device
      const device = await adapter.requestDevice({
        requiredFeatures: this.config.requiredFeatures,
        requiredLimits: this.config.requiredLimits,
      });

      // Set up error handling
      device.onuncapturederror = (event: GPUUncapturedErrorEvent) => {
        logger.error("WebGPU uncaptured error:", event.error);
        this.emit("error", event.error);
      };

      if (this.config.enableDebug) {
        device.pushErrorScope("validation");
        device.pushErrorScope("out-of-memory");
        device.pushErrorScope("internal");
      }

      this.contextInfo = {
        adapter,
        device,
        queue: device.queue,
        limits: adapter.limits,
        features: adapter.features,
      };

      this.isInitialized = true;
      this.startRenderLoop();

      this.emit("ready", undefined);
    } catch (error) {
      logger.error("Failed to initialize WebGPU context:", error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Get the WebGPU device
   */
  getDevice(): GPUDevice {
    if (!this.contextInfo) {
      throw new Error("WebGPU context not initialized");
    }
    return this.contextInfo.device;
  }

  /**
   * Get the WebGPU queue
   */
  getQueue(): GPUCommandQueue {
    if (!this.contextInfo) {
      throw new Error("WebGPU context not initialized");
    }
    return this.contextInfo.queue;
  }

  /**
   * Get adapter info
   */
  getAdapterInfo(): { limits: GPUSupportedLimits; features: GPUSupportedFeatures } {
    if (!this.contextInfo) {
      throw new Error("WebGPU context not initialized");
    }
    return {
      limits: this.contextInfo.limits,
      features: this.contextInfo.features,
    };
  }

  /**
   * Create canvas context
   */
  createCanvasContext(canvas: HTMLCanvasElement): GPUCanvasContext {
    const device = this.getDevice();
    const context = canvas.getContext("webgpu");

    if (!context) {
      throw new Error("Failed to get WebGPU canvas context");
    }

    const format = navigator.gpu?.getPreferredCanvasFormat?.() || "bgra8unorm";
    context.configure({
      device,
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      alphaMode: "premultiplied",
    });

    // Store context info
    if (this.contextInfo) {
      this.contextInfo.canvas = canvas;
      this.contextInfo.context = context;
    }

    return context;
  }

  /**
   * Create shared buffer that can be used by multiple systems
   */
  createSharedBuffer(
    id: string,
    size: number,
    usage: GPUBufferUsageFlags,
    label?: string,
  ): SharedBuffer {
    if (this.sharedBuffers.has(id)) {
      throw new Error(`Shared buffer with id '${id}' already exists`);
    }

    const device = this.getDevice();
    const buffer = device.createBuffer({
      size,
      usage,
      label: label || `SharedBuffer_${id}`,
    });

    const sharedBuffer: SharedBuffer = {
      id,
      buffer,
      size,
      usage,
      ...(label !== undefined && { label }),
    };

    this.sharedBuffers.set(id, sharedBuffer);
    return sharedBuffer;
  }

  /**
   * Get shared buffer by ID
   */
  getSharedBuffer(id: string): SharedBuffer | null {
    return this.sharedBuffers.get(id) || null;
  }

  /**
   * Create shared render target
   */
  createSharedRenderTarget(
    id: string,
    width: number,
    height: number,
    format: GPUTextureFormat = "rgba8unorm",
    usage: GPUTextureUsageFlags = GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.TEXTURE_BINDING,
    label?: string,
  ): SharedRenderTarget {
    if (this.sharedTextures.has(id)) {
      throw new Error(`Shared render target with id '${id}' already exists`);
    }

    const device = this.getDevice();
    const texture = device.createTexture({
      size: { width, height },
      format,
      usage,
      label: label || `SharedRenderTarget_${id}`,
    });

    const view = texture.createView();

    const renderTarget: SharedRenderTarget = {
      id,
      texture,
      view,
      format,
      width,
      height,
      usage,
      ...(label !== undefined && { label }),
    };

    this.sharedTextures.set(id, renderTarget);
    return renderTarget;
  }

  /**
   * Get shared render target by ID
   */
  getSharedRenderTarget(id: string): SharedRenderTarget | null {
    return this.sharedTextures.get(id) || null;
  }

  /**
   * Register compute job for scheduling
   */
  registerComputeJob(job: ComputeJob): void {
    this.computeJobs.set(job.id, job);
  }

  /**
   * Execute compute job
   */
  executeComputeJob(jobId: string): void {
    const job = this.computeJobs.get(jobId);
    if (!job) {
      throw new Error(`Compute job '${jobId}' not found`);
    }

    const device = this.getDevice();
    const commandEncoder = device.createCommandEncoder({
      label: `ComputeJob_${jobId}`,
    });

    const computePass = commandEncoder.beginComputePass({
      label: job.label || `ComputePass_${jobId}`,
    });

    computePass.setPipeline(job.pipeline);

    for (let i = 0; i < job.bindGroups.length; i++) {
      const bindGroup = job.bindGroups[i];
      if (bindGroup) {
        computePass.setBindGroup(i, bindGroup);
      }
    }

    computePass.dispatchWorkgroups(
      job.workgroupSize[0],
      job.workgroupSize[1],
      job.workgroupSize[2],
    );

    computePass.end();

    const commandBuffer = commandEncoder.finish();
    this.getQueue().submit([commandBuffer]);
  }

  /**
   * Add frame callback for systems that need per-frame updates
   */
  addFrameCallback(callback: (deltaTime: number) => void): () => void {
    this.frameCallbacks.add(callback);

    return () => {
      this.frameCallbacks.delete(callback);
    };
  }

  /**
   * Create command encoder with proper labeling
   */
  createCommandEncoder(label?: string): GPUCommandEncoder {
    const device = this.getDevice();
    return device.createCommandEncoder(label ? { label } : {});
  }

  /**
   * Submit command buffers to queue
   */
  submitCommands(commandBuffers: GPUCommandBuffer[]): void {
    this.getQueue().submit(commandBuffers);
  }

  /**
   * Copy data between shared buffers
   */
  copyBuffer(
    srcId: string,
    dstId: string,
    srcOffset: number = 0,
    dstOffset: number = 0,
    size?: number,
  ): void {
    const srcBuffer = this.getSharedBuffer(srcId);
    const dstBuffer = this.getSharedBuffer(dstId);

    if (!srcBuffer || !dstBuffer) {
      throw new Error("Source or destination buffer not found");
    }

    const copySize = size || Math.min(srcBuffer.size - srcOffset, dstBuffer.size - dstOffset);

    const commandEncoder = this.createCommandEncoder("BufferCopy");
    commandEncoder.copyBufferToBuffer(
      srcBuffer.buffer,
      srcOffset,
      dstBuffer.buffer,
      dstOffset,
      copySize,
    );

    this.submitCommands([commandEncoder.finish()]);
  }

  /**
   * Get memory usage statistics
   */
  getMemoryUsage(): { buffers: number; textures: number; total: number } {
    let bufferMemory = 0;
    let textureMemory = 0;

    for (const buffer of this.sharedBuffers.values()) {
      bufferMemory += buffer.size;
    }

    for (const texture of this.sharedTextures.values()) {
      // Rough estimation of texture memory usage
      const bytesPerPixel = this.getBytesPerPixel(texture.format);
      textureMemory += texture.width * texture.height * bytesPerPixel;
    }

    return {
      buffers: bufferMemory,
      textures: textureMemory,
      total: bufferMemory + textureMemory,
    };
  }

  /**
   * Cleanup and dispose of resources
   */
  dispose(): void {
    if (this.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Destroy shared buffers
    for (const buffer of this.sharedBuffers.values()) {
      buffer.buffer.destroy();
    }
    this.sharedBuffers.clear();

    // Destroy shared textures
    for (const texture of this.sharedTextures.values()) {
      texture.texture.destroy();
    }
    this.sharedTextures.clear();

    this.computeJobs.clear();
    this.frameCallbacks.clear();

    // Destroy device
    if (this.contextInfo) {
      this.contextInfo.device.destroy();
    }

    this.isInitialized = false;
    this.removeAllListeners();
  }

  // Private helper methods

  private startRenderLoop(): void {
    const renderFrame = (currentTime: number) => {
      const deltaTime = currentTime - this.lastFrameTime;
      this.lastFrameTime = currentTime;

      // Execute frame callbacks
      for (const callback of this.frameCallbacks) {
        try {
          callback(deltaTime);
        } catch (error) {
          logger.error("Error in frame callback:", error as Record<string, any>);
        }
      }

      this.animationFrameId = requestAnimationFrame(renderFrame);
    };

    this.animationFrameId = requestAnimationFrame(renderFrame);
  }

  private getBytesPerPixel(format: GPUTextureFormat): number {
    // Simplified calculation - would be more comprehensive in production
    const formatSizes: Record<string, number> = {
      rgba8unorm: 4,
      "rgba8unorm-srgb": 4,
      bgra8unorm: 4,
      "bgra8unorm-srgb": 4,
      rgba16float: 8,
      rgba32float: 16,
      depth24plus: 4,
      depth32float: 4,
    };

    return formatSizes[format] || 4;
  }
}

// Export singleton instance
export const _webgpuContextManager = new WebGPUContextManager();
