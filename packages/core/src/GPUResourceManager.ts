/**
 * Unified GPU Resource Manager - Consolidates GPU resource management
 * across renderer, physics, and audio systems
 */

import { EventEmitter, SystemEvents } from './EventEmitter';
import { logger } from '@vtt/logging';
import { 
  GPUResourceManager as IGPUResourceManager, 
  GPUResourceInfo, 
  Disposable 
} from './SharedInterfaces';

export interface GPUResourceConfig {
  maxBufferSize: number;
  maxTextureSize: number;
  enableResourceTracking: boolean;
  enableMemoryProfiling: boolean;
  warningThresholds: {
    memoryUsage: number;
    resourceCount: number;
  };
}

export interface BufferDescriptor {
  size: number;
  usage: number;
  label?: string;
  mappedAtCreation?: boolean;
}

export interface TextureDescriptor {
  width: number;
  height: number;
  depth?: number;
  format: string;
  usage: number;
  mipLevelCount?: number;
  sampleCount?: number;
  label?: string;
}

export class UnifiedGPUResourceManager extends EventEmitter<SystemEvents> implements IGPUResourceManager {
  private config: GPUResourceConfig;
  private resources = new Map<string, GPUResourceInfo>();
  private buffers = new Map<string, any>(); // GPUBuffer placeholder
  private textures = new Map<string, any>(); // GPUTexture placeholder
  private pipelines = new Map<string, any>(); // GPUPipeline placeholder
  private samplers = new Map<string, any>(); // GPUSampler placeholder
  
  private resourceCounter = 0;
  private memoryUsage = { used: 0, total: 0 };
  private cleanupScheduled = false;

  constructor(config: Partial<GPUResourceConfig> = {}) {
    super();
    
    this.config = {
      maxBufferSize: 256 * 1024 * 1024, // 256MB
      maxTextureSize: 4096,
      enableResourceTracking: true,
      enableMemoryProfiling: true,
      warningThresholds: {
        memoryUsage: 0.8, // 80%
        resourceCount: 1000
      },
      ...config
    };
  }

  /**
   * Initialize the GPU resource manager
   */
  async initialize(): Promise<void> {
    try {
      // Initialize GPU context and device
      // This would normally initialize WebGPU, but for now it's a placeholder
      this.memoryUsage.total = this.config.maxBufferSize;
      
      if (this.config.enableMemoryProfiling) {
        this.startMemoryMonitoring();
      }
      
      this.emit('ready', undefined);
    } catch (error) {
      logger.error('Failed to initialize GPU resource manager:', error);
      throw error;
    }
  }

  /**
   * Create a GPU buffer
   */
  createBuffer(size: number, usage: number, label?: string): string {
    if (size > this.config.maxBufferSize) {
      throw new Error(`Buffer size ${size} exceeds maximum ${this.config.maxBufferSize}`);
    }

    const id = this.generateResourceId();
    
    // Placeholder buffer creation - would create actual GPUBuffer
    const buffer = {
      size,
      usage,
      label,
      destroy: () => this.destroyBuffer(id)
    };

    const resourceInfo: GPUResourceInfo = {
      id,
      type: 'buffer',
      size,
      usage,
      ...(label !== undefined && { label }),
      createdAt: new Date(),
      lastUsed: new Date()
    };

    this.buffers.set(id, buffer);
    this.resources.set(id, resourceInfo);
    this.memoryUsage.used += size;

    this.checkMemoryThresholds();
    
    return id;
  }

  /**
   * Create a GPU texture
   */
  createTexture(width: number, height: number, format: string, usage: number, label?: string): string {
    if (width > this.config.maxTextureSize || height > this.config.maxTextureSize) {
      throw new Error(`Texture size ${width}x${height} exceeds maximum ${this.config.maxTextureSize}`);
    }

    const id = this.generateResourceId();
    const bytesPerPixel = this.getBytesPerPixel(format);
    const size = width * height * bytesPerPixel;

    // Placeholder texture creation - would create actual GPUTexture
    const texture = {
      width,
      height,
      format,
      usage,
      label,
      destroy: () => this.destroyTexture(id)
    };

    const resourceInfo: GPUResourceInfo = {
      id,
      type: 'texture',
      size,
      usage,
      ...(label !== undefined && { label }),
      createdAt: new Date(),
      lastUsed: new Date()
    };

    this.textures.set(id, texture);
    this.resources.set(id, resourceInfo);
    this.memoryUsage.used += size;

    this.checkMemoryThresholds();
    
    return id;
  }

  /**
   * Get resource information
   */
  getResource(id: string): GPUResourceInfo | null {
    const resource = this.resources.get(id);
    if (resource) {
      resource.lastUsed = new Date();
      return resource;
    }
    return null;
  }

  /**
   * Destroy a resource
   */
  destroyResource(id: string): void {
    const resource = this.resources.get(id);
    if (!resource) return;

    switch (resource.type) {
      case 'buffer':
        this.destroyBuffer(id);
        break;
      case 'texture':
        this.destroyTexture(id);
        break;
      case 'pipeline':
        this.destroyPipeline(id);
        break;
      case 'sampler':
        this.destroySampler(id);
        break;
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryUsage(): { used: number; total: number } {
    return { ...this.memoryUsage };
  }

  /**
   * Get all resources of a specific type
   */
  getResourcesByType(type: GPUResourceInfo['type']): GPUResourceInfo[] {
    return Array.from(this.resources.values()).filter(r => r.type === type);
  }

  /**
   * Schedule cleanup of unused resources
   */
  scheduleCleanup(): void {
    if (this.cleanupScheduled) return;
    
    this.cleanupScheduled = true;
    setTimeout(() => {
      this.performCleanup();
      this.cleanupScheduled = false;
    }, 5000); // Cleanup after 5 seconds
  }

  /**
   * Get buffer by ID
   */
  getBuffer(id: string): any | null {
    return this.buffers.get(id) || null;
  }

  /**
   * Get texture by ID
   */
  getTexture(id: string): any | null {
    return this.textures.get(id) || null;
  }

  /**
   * Get pipeline by ID
   */
  getPipeline(id: string): any | null {
    return this.pipelines.get(id) || null;
  }

  /**
   * Get sampler by ID
   */
  getSampler(id: string): any | null {
    return this.samplers.get(id) || null;
  }

  /**
   * Create a render pipeline
   */
  createRenderPipeline(descriptor: any, label?: string): string {
    const id = this.generateResourceId();
    
    // Placeholder pipeline creation
    const pipeline = {
      ...descriptor,
      label,
      destroy: () => this.destroyPipeline(id)
    };

    const size = 1024; // Estimated size
    const usage = 0;

    const resourceInfo: GPUResourceInfo = {
      id,
      type: 'pipeline',
      size,
      usage,
      ...(label !== undefined && { label }),
      createdAt: new Date(),
      lastUsed: new Date()
    };

    this.pipelines.set(id, pipeline);
    this.resources.set(id, resourceInfo);
    
    return id;
  }

  /**
   * Create a compute pipeline
   */
  createComputePipeline(descriptor: any, label?: string): string {
    return this.createRenderPipeline(descriptor, label); // Same implementation for now
  }

  /**
   * Create a sampler
   */
  createSampler(descriptor: any, label?: string): string {
    const id = this.generateResourceId();
    
    // Placeholder sampler creation
    const sampler = {
      ...descriptor,
      label,
      destroy: () => this.destroySampler(id)
    };

    const size = 64; // Estimated size
    const usage = 0;

    const resourceInfo: GPUResourceInfo = {
      id,
      type: 'sampler',
      size,
      usage,
      ...(label !== undefined && { label }),
      createdAt: new Date(),
      lastUsed: new Date()
    };

    this.samplers.set(id, sampler);
    this.resources.set(id, resourceInfo);
    
    return id;
  }

  /**
   * Get resource statistics
   */
  getStats(): {
    totalResources: number;
    memoryUsage: { used: number; total: number; percentage: number };
    resourcesByType: Record<string, number>;
    oldestResource: Date | null;
    newestResource: Date | null;
  } {
    const resourcesByType: Record<string, number> = {};
    let oldestResource: Date | null = null;
    let newestResource: Date | null = null;

    for (const resource of this.resources.values()) {
      resourcesByType[resource.type] = (resourcesByType[resource.type] || 0) + 1;
      
      if (!oldestResource || resource.createdAt < oldestResource) {
        oldestResource = resource.createdAt;
      }
      
      if (!newestResource || resource.createdAt > newestResource) {
        newestResource = resource.createdAt;
      }
    }

    return {
      totalResources: this.resources.size,
      memoryUsage: {
        used: this.memoryUsage.used,
        total: this.memoryUsage.total,
        percentage: this.memoryUsage.total > 0 ? this.memoryUsage.used / this.memoryUsage.total : 0
      },
      resourcesByType,
      oldestResource,
      newestResource
    };
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    // Destroy all resources
    for (const id of this.resources.keys()) {
      this.destroyResource(id);
    }

    this.resources.clear();
    this.buffers.clear();
    this.textures.clear();
    this.pipelines.clear();
    this.samplers.clear();

    this.memoryUsage = { used: 0, total: 0 };
    this.removeAllListeners();
  }

  // Private helper methods

  private destroyBuffer(id: string): void {
    const buffer = this.buffers.get(id);
    const resource = this.resources.get(id);
    
    if (buffer && resource) {
      // Would call buffer.destroy() for real GPUBuffer
      this.buffers.delete(id);
      this.resources.delete(id);
      this.memoryUsage.used -= resource.size;
    }
  }

  private destroyTexture(id: string): void {
    const texture = this.textures.get(id);
    const resource = this.resources.get(id);
    
    if (texture && resource) {
      // Would call texture.destroy() for real GPUTexture
      this.textures.delete(id);
      this.resources.delete(id);
      this.memoryUsage.used -= resource.size;
    }
  }

  private destroyPipeline(id: string): void {
    const pipeline = this.pipelines.get(id);
    const resource = this.resources.get(id);
    
    if (pipeline && resource) {
      this.pipelines.delete(id);
      this.resources.delete(id);
    }
  }

  private destroySampler(id: string): void {
    const sampler = this.samplers.get(id);
    const resource = this.resources.get(id);
    
    if (sampler && resource) {
      this.samplers.delete(id);
      this.resources.delete(id);
    }
  }

  private performCleanup(): void {
    const now = new Date();
    const maxAge = 60000; // 1 minute
    const resourcesToCleanup: string[] = [];

    for (const [id, resource] of this.resources) {
      if (now.getTime() - resource.lastUsed.getTime() > maxAge) {
        resourcesToCleanup.push(id);
      }
    }

    for (const id of resourcesToCleanup) {
      this.destroyResource(id);
    }

    if (resourcesToCleanup.length > 0) {
      logger.info(`Cleaned up ${resourcesToCleanup.length} unused GPU resources`);
    }
  }

  private checkMemoryThresholds(): void {
    const usage = this.memoryUsage.used / this.memoryUsage.total;
    
    if (usage > this.config.warningThresholds.memoryUsage) {
      logger.warn(`GPU memory usage high: ${(usage * 100).toFixed(1)}%`);
      this.scheduleCleanup();
    }

    if (this.resources.size > this.config.warningThresholds.resourceCount) {
      logger.warn(`GPU resource count high: ${this.resources.size}`);
      this.scheduleCleanup();
    }
  }

  private startMemoryMonitoring(): void {
    setInterval(() => {
      const stats = this.getStats();
      if (stats.memoryUsage.percentage > 0.9) {
        logger.warn('GPU memory usage critical:', stats.memoryUsage);
        this.performCleanup();
      }
    }, 10000); // Check every 10 seconds
  }

  private generateResourceId(): string {
    return `gpu_${++this.resourceCounter}_${Date.now()}`;
  }

  private getBytesPerPixel(format: string): number {
    // Simplified format to bytes mapping
    const formatSizes: Record<string, number> = {
      'rgba8unorm': 4,
      'rgba8unorm-srgb': 4,
      'bgra8unorm': 4,
      'bgra8unorm-srgb': 4,
      'rgba16float': 8,
      'rgba32float': 16,
      'depth24plus': 4,
      'depth32float': 4,
      'r8unorm': 1,
      'rg8unorm': 2,
      'rgb8unorm': 3
    };

    return formatSizes[format] || 4;
  }
}
