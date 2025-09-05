// GPUTextureUsage is available as browser global
import { logger } from "@vtt/logging";

export interface TextureInfo {
  texture: GPUTexture;
  view: GPUTextureView;
  width: number;
  height: number;
  format: GPUTextureFormat;
  usage: GPUTextureUsageFlags;
  label?: string;
}

export interface SamplerInfo {
  sampler: GPUSampler;
  label?: string;
}

export class TextureManager {
  private device: GPUDevice;
  private textures = new Map<string, TextureInfo>();
  private samplers = new Map<string, SamplerInfo>();

  constructor(device: GPUDevice) {
    this.device = device;
  }

  createTexture(
    label: string,
    width: number,
    height: number,
    format: GPUTextureFormat,
    usage: GPUTextureUsageFlags,
    sampleCount = 1
  ): GPUTexture {
    const texture = this.device.createTexture({
      label,
      size: [width, height],
      format,
      usage,
      sampleCount,
    });

    const view = texture.createView({
      label: `${label}_view`,
    });

    this.textures.set(label, {
      texture,
      view,
      width,
      height,
      format,
      usage,
      label,
    });

    return texture;
  }

  createTextureFromImageData(
    label: string,
    imageData: ImageData | HTMLImageElement | HTMLCanvasElement,
    generateMipmaps = true
  ): GPUTexture {
    let width: number, height: number;
    
    if (imageData instanceof ImageData) {
      width = imageData.width;
      height = imageData.height;
    } else {
      width = imageData.width;
      height = imageData.height;
    }

    const mipLevelCount = generateMipmaps ? Math.floor(Math.log2(Math.max(width, height))) + 1 : 1;

    const texture = this.device.createTexture({
      label,
      size: [width, height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      mipLevelCount,
    });

    // Copy image data to texture
    if (imageData instanceof ImageData) {
      this.device.queue.writeTexture(
        { texture },
        imageData.data,
        { bytesPerRow: width * 4 },
        { width, height }
      );
    } else {
      // For HTMLImageElement or HTMLCanvasElement, we need to create a canvas context
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(imageData, 0, 0);
      const data = ctx.getImageData(0, 0, width, height);
      
      this.device.queue.writeTexture(
        { texture },
        data.data,
        { bytesPerRow: width * 4 },
        { width, height }
      );
    }

    // Generate mipmaps if requested
    if (generateMipmaps && mipLevelCount > 1) {
      this.generateMipmaps(texture, width, height, mipLevelCount);
    }

    const view = texture.createView({
      label: `${label}_view`,
    });

    this.textures.set(label, {
      texture,
      view,
      width,
      height,
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      label,
    });

    return texture;
  }

  createDepthTexture(label: string, width: number, height: number, sampleCount = 1): GPUTexture {
    return this.createTexture(
      label,
      width,
      height,
      "depth32float",
      GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      sampleCount
    );
  }

  createHDRTexture(label: string, width: number, height: number, sampleCount = 1): GPUTexture {
    return this.createTexture(
      label,
      width,
      height,
      "rgba16float",
      GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      sampleCount
    );
  }

  createSampler(
    label: string,
    magFilter: GPUFilterMode = "linear",
    minFilter: GPUFilterMode = "linear",
    mipmapFilter: GPUMipmapFilterMode = "linear",
    addressModeU: GPUAddressMode = "repeat",
    addressModeV: GPUAddressMode = "repeat",
    maxAnisotropy = 1
  ): GPUSampler {
    const sampler = this.device.createSampler({
      label,
      magFilter,
      minFilter,
      mipmapFilter,
      addressModeU,
      addressModeV,
      maxAnisotropy,
    });

    this.samplers.set(label, { sampler, label });
    return sampler;
  }

  createComparisonSampler(label: string): GPUSampler {
    const sampler = this.device.createSampler({
      label,
      compare: "less",
      magFilter: "linear",
      minFilter: "linear",
    });

    this.samplers.set(label, { sampler, label });
    return sampler;
  }

  private generateMipmaps(texture: GPUTexture, width: number, height: number, mipLevelCount: number): void {
    // Simple mipmap generation using compute shader would be ideal,
    // but for now we'll skip this implementation detail
    // In a production system, you'd implement a compute shader for mipmap generation
    logger.info(`Mipmap generation requested for ${width}x${height} texture with ${mipLevelCount} levels`);
  }

  getTexture(label: string): GPUTexture | undefined {
    return this.textures.get(label)?.texture;
  }

  getTextureView(label: string): GPUTextureView | undefined {
    return this.textures.get(label)?.view;
  }

  getSampler(label: string): GPUSampler | undefined {
    return this.samplers.get(label)?.sampler;
  }

  createDefaultTextures(): void {
    // Create a default white texture (1x1)
    const whitePixel = new Uint8Array([255, 255, 255, 255]);
    const whiteTexture = this.device.createTexture({
      label: "default_white",
      size: [1, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    this.device.queue.writeTexture(
      { texture: whiteTexture },
      whitePixel,
      { bytesPerRow: 4 },
      { width: 1, height: 1 }
    );

    this.textures.set("default_white", {
      texture: whiteTexture,
      view: whiteTexture.createView(),
      width: 1,
      height: 1,
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      label: "default_white",
    });

    // Create a default normal map (flat normal pointing up)
    const normalPixel = new Uint8Array([128, 128, 255, 255]); // (0, 0, 1) in normal map space
    const normalTexture = this.device.createTexture({
      label: "default_normal",
      size: [1, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    this.device.queue.writeTexture(
      { texture: normalTexture },
      normalPixel,
      { bytesPerRow: 4 },
      { width: 1, height: 1 }
    );

    this.textures.set("default_normal", {
      texture: normalTexture,
      view: normalTexture.createView(),
      width: 1,
      height: 1,
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      label: "default_normal",
    });

    // Create default samplers
    this.createSampler("default_sampler");
    this.createSampler("clamp_sampler", "linear", "linear", "linear", "clamp-to-edge", "clamp-to-edge");
    this.createComparisonSampler("shadow_sampler");

    logger.info("Default textures and samplers created");
  }

  destroyTexture(label: string): void {
    const textureInfo = this.textures.get(label);
    if (textureInfo) {
      textureInfo.texture.destroy();
      this.textures.delete(label);
    }
  }

  destroySampler(label: string): void {
    this.samplers.delete(label);
  }

  dispose(): void {
    for (const [label, textureInfo] of this.textures) {
      textureInfo.texture.destroy();
    }
    this.textures.clear();
    this.samplers.clear();
    logger.info("Texture manager disposed");
  }

  getMemoryUsage(): number {
    let totalSize = 0;
    for (const textureInfo of this.textures.values()) {
      // Rough estimation: width * height * bytes per pixel * mip levels
      const bytesPerPixel = this.getBytesPerPixel(textureInfo.format);
      const mipLevels = Math.floor(Math.log2(Math.max(textureInfo.width, textureInfo.height))) + 1;
      totalSize += textureInfo.width * textureInfo.height * bytesPerPixel * (4/3); // Approximate mip chain size
    }
    return totalSize;
  }

  private getBytesPerPixel(format: GPUTextureFormat): number {
    switch (format) {
      case "rgba8unorm":
      case "rgba8unorm-srgb":
        return 4;
      case "rgba16float":
        return 8;
      case "rgba32float":
        return 16;
      case "depth32float":
        return 4;
      default:
        return 4; // Default assumption
    }
  }
}
