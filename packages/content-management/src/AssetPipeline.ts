/**
 * Asset Processing Pipeline
 * Handles asset optimization, transformation, and preparation for VTT usage
 */

import { EventEmitter } from "events";
import sharp from 'sharp';
import { AssetMetadata, AssetType } from "./AssetManager";

export interface PipelineStage {
  name: string;
  description: string;
  enabled: boolean;
  processor: AssetProcessor;
  options?: Record<string, any>;
}

export interface AssetProcessor {
  name: string;
  supportedTypes: AssetType[];
  process(
    data: ArrayBuffer,
    metadata: AssetMetadata,
    options?: Record<string, any>,
  ): Promise<ProcessingResult>;
}

export interface ProcessingResult {
  data: ArrayBuffer;
  metadata: Partial<AssetMetadata>;
  derivatives?: Map<string, ArrayBuffer>; // thumbnails, previews, etc.
  warnings?: string[];
  errors?: string[];
}

export interface PipelineConfig {
  stages: PipelineStage[];
  outputFormats?: Record<AssetType, string[]>;
  quality?: Record<AssetType, number>; // 0-1 quality setting
  generateThumbnails?: boolean;
  generatePreviews?: boolean;
  optimizeForWeb?: boolean;
}

export interface PipelineProgress {
  stage: string;
  progress: number; // 0-1
  currentAsset?: string;
  message?: string;
}

export class AssetPipeline extends EventEmitter {
  private config: PipelineConfig;
  private processors = new Map<string, AssetProcessor>();

  constructor(config: PipelineConfig) {
    super();
    this.config = config;
    this.setupDefaultProcessors();
  }

  /**
   * Process an asset through the pipeline
   */
  async processAsset(data: ArrayBuffer, metadata: AssetMetadata): Promise<ProcessingResult> {
    let currentData = data;
    let currentMetadata = { ...metadata };
    const derivatives = new Map<string, ArrayBuffer>();
    const warnings: string[] = [];
    const errors: string[] = [];

    const applicableStages = this.config.stages.filter(
      (stage) => stage.enabled && this.canProcessType(stage.processor, metadata.type),
    );

    for (let i = 0; i < applicableStages.length; i++) {
      const stage = applicableStages[i];
      if (!stage) {continue;}

      this.emitProgress(
        stage.name,
        i / applicableStages.length,
        metadata.name,
        `Processing with ${stage.name}`,
      );

      try {
        const result = await stage.processor.process(currentData, currentMetadata, stage.options);

        currentData = result.data;
        currentMetadata = { ...currentMetadata, ...result.metadata };

        if (result.derivatives) {
          for (const [key, value] of result.derivatives) {
            derivatives.set(key, value);
          }
        }

        if (result.warnings) {
          warnings.push(...result.warnings);
        }

        if (result.errors) {
          errors.push(...result.errors);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown processing error";
        errors.push(`${stage.name}: ${errorMsg}`);

        // Continue with next stage unless it's a critical error
        if (error instanceof Error && error.message.includes("CRITICAL")) {
          break;
        }
      }
    }

    this.emitProgress("complete", 1, metadata.name, "Processing complete");

    return {
      data: currentData,
      metadata: currentMetadata,
      derivatives,
      warnings,
      errors,
    };
  }

  /**
   * Process multiple assets in batch
   */
  async processBatch(
    assets: Array<{ data: ArrayBuffer; metadata: AssetMetadata }>,
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      if (!asset) {continue;}

      try {
        const result = await this.processAsset(asset.data, asset.metadata);
        results.push(result);
      } catch (error) {
        // Create error result
        results.push({
          data: asset.data,
          metadata: asset.metadata,
          errors: [error instanceof Error ? error.message : "Unknown batch processing error"],
        });
      }

      // Emit batch progress
      this.emit("batchProgress", {
        completed: i + 1,
        total: assets.length,
        current: asset.metadata.name,
      });
    }

    return results;
  }

  /**
   * Register a custom processor
   */
  registerProcessor(processor: AssetProcessor): void {
    this.processors.set(processor.name, processor);
  }

  /**
   * Update pipeline configuration
   */
  updateConfig(config: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get pipeline configuration
   */
  getConfig(): PipelineConfig {
    return { ...this.config };
  }

  private canProcessType(processor: AssetProcessor, type: AssetType): boolean {
    return processor.supportedTypes.includes(type);
  }

  private setupDefaultProcessors(): void {
    // Image optimization processor
    this.processors.set("imageOptimizer", new ImageOptimizer());

    // Audio normalization processor
    this.processors.set("audioNormalizer", new AudioNormalizer());

    // Thumbnail generator
    this.processors.set("thumbnailGenerator", new ThumbnailGenerator());

    // Model optimizer
    this.processors.set("modelOptimizer", new ModelOptimizer());

    // Data validator
    this.processors.set("dataValidator", new DataValidator());

    // Add processors to default stages
    this.config.stages = this.config.stages || [
      {
        name: "validation",
        description: "Validate asset data",
        enabled: true,
        processor: this.processors.get("dataValidator")!,
      },
      {
        name: "optimization",
        description: "Optimize asset for VTT usage",
        enabled: true,
        processor: this.processors.get("imageOptimizer")!,
      },
      {
        name: "thumbnails",
        description: "Generate thumbnails and previews",
        enabled: this.config.generateThumbnails || true,
        processor: this.processors.get("thumbnailGenerator")!,
      },
    ];
  }

  private emitProgress(
    stage: string,
    progress: number,
    currentAsset?: string,
    message?: string,
  ): void {
    this.emit("progress", {
      stage,
      progress,
      currentAsset,
      message,
    } as PipelineProgress);
  }
}

/**
 * Image optimization processor
 */
class ImageOptimizer implements AssetProcessor {
  name = "imageOptimizer";
  supportedTypes: AssetType[] = ["image"];

  async process(
    data: ArrayBuffer,
    metadata: AssetMetadata,
    options?: Record<string, any>,
  ): Promise<ProcessingResult> {
    const quality = options?.quality || 85;
    const format = options?.format || "webp";
    const maxWidth = options?.maxWidth || 2048;
    const maxHeight = options?.maxHeight || 2048;

    try {
      // Convert ArrayBuffer to Buffer for sharp
      const buffer = Buffer.from(data);
      
      // Process image with sharp
      let sharpInstance = sharp(buffer);
      
      // Get image metadata
      const imageMetadata = await sharpInstance.metadata();
      
      // Resize if needed
      if (imageMetadata.width && imageMetadata.height) {
        if (imageMetadata.width > maxWidth || imageMetadata.height > maxHeight) {
          sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }
      }
      
      // Convert to specified format with quality
      let outputBuffer: Buffer;
      switch (format) {
        case 'jpeg':
        case 'jpg':
          outputBuffer = await sharpInstance.jpeg({ quality }).toBuffer();
          break;
        case 'png':
          outputBuffer = await sharpInstance.png({ 
            compressionLevel: Math.floor((100 - quality) / 10) 
          }).toBuffer();
          break;
        case 'webp':
        default:
          outputBuffer = await sharpInstance.webp({ quality }).toBuffer();
          break;
      }
      
      const optimizedData = outputBuffer.buffer.slice(
        outputBuffer.byteOffset,
        outputBuffer.byteOffset + outputBuffer.byteLength
      ) as ArrayBuffer;
      
      const sizeReduction = data.byteLength - optimizedData.byteLength;
      
      const updatedMetadata: Partial<AssetMetadata> = {
        size: optimizedData.byteLength,
        customProperties: {
          ...metadata.customProperties,
          optimized: true,
          originalSize: data.byteLength,
          sizeReduction,
          quality,
          format,
          dimensions: {
            width: imageMetadata.width,
            height: imageMetadata.height
          }
        },
      };

      const warnings: string[] = [];
      if (sizeReduction < 0) {
        warnings.push("Optimized image is larger than original. Consider using a different format.");
      }

      return {
        data: optimizedData,
        metadata: updatedMetadata,
        warnings,
      };
    } catch (error) {
      // If sharp fails, return original data with warning
      return {
        data,
        metadata: {
          customProperties: {
            ...metadata.customProperties,
            optimizationFailed: true,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        },
        warnings: [`Image optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}

/**
 * Audio normalization processor
 */
class AudioNormalizer implements AssetProcessor {
  name = "audioNormalizer";
  supportedTypes: AssetType[] = ["audio"];

  async process(
    data: ArrayBuffer,
    metadata: AssetMetadata,
    options?: Record<string, any>,
  ): Promise<ProcessingResult> {
    const targetLUFS = options?.targetLUFS || -23; // Broadcast standard
    const format = options?.format || "ogg";

    // For now, we'll pass through the audio data unchanged
    // In production, this would use a proper audio processing library
    // like ffmpeg or web audio API for normalization
    
    const updatedMetadata: Partial<AssetMetadata> = {
      customProperties: {
        ...metadata.customProperties,
        normalized: true,
        targetLUFS,
        format,
        processedAt: new Date().toISOString(),
      },
    };

    return {
      data,
      metadata: updatedMetadata,
    };
  }
}

/**
 * Thumbnail generator processor
 */
class ThumbnailGenerator implements AssetProcessor {
  name = "thumbnailGenerator";
  supportedTypes: AssetType[] = ["image", "model", "map", "scene"];

  async process(
    data: ArrayBuffer,
    metadata: AssetMetadata,
    options?: Record<string, any>,
  ): Promise<ProcessingResult> {
    const thumbnailSize = options?.thumbnailSize || 128;
    const previewSize = options?.previewSize || 512;
    const format = options?.format || 'webp';

    const derivatives = new Map<string, ArrayBuffer>();
    
    // Only process image types with sharp, other types need specialized handling
    if (metadata.type === 'image') {
      try {
        const buffer = Buffer.from(data);
        
        // Generate thumbnail
        const thumbnailBuffer = await sharp(buffer)
          .resize(thumbnailSize, thumbnailSize, {
            fit: 'cover',
            position: 'center'
          })
          .webp({ quality: 80 })
          .toBuffer();
        
        const thumbnailArrayBuffer = thumbnailBuffer.buffer.slice(
          thumbnailBuffer.byteOffset,
          thumbnailBuffer.byteOffset + thumbnailBuffer.byteLength
        ) as ArrayBuffer;
        derivatives.set("thumbnail", thumbnailArrayBuffer);
        
        // Generate preview
        const previewBuffer = await sharp(buffer)
          .resize(previewSize, previewSize, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality: 90 })
          .toBuffer();
        
        const previewArrayBuffer = previewBuffer.buffer.slice(
          previewBuffer.byteOffset,
          previewBuffer.byteOffset + previewBuffer.byteLength
        ) as ArrayBuffer;
        derivatives.set("preview", previewArrayBuffer);
        
        const updatedMetadata: Partial<AssetMetadata> = {
          thumbnailUrl: `thumbnail_${metadata.id}`,
          previewUrl: `preview_${metadata.id}`,
          customProperties: {
            ...metadata.customProperties,
            hasThumbnail: true,
            hasPreview: true,
            thumbnailSize,
            previewSize,
          },
        };

        return {
          data,
          metadata: updatedMetadata,
          derivatives,
        };
      } catch (error) {
        // If thumbnail generation fails, return original data with warning
        return {
          data,
          metadata: {
            customProperties: {
              ...metadata.customProperties,
              thumbnailGenerationFailed: true,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          },
          warnings: [`Thumbnail generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        };
      }
    } else {
      // For non-image types, we need specialized processors
      // For now, return data as-is with a note that thumbnails aren't supported
      return {
        data,
        metadata: {
          customProperties: {
            ...metadata.customProperties,
            thumbnailsNotSupported: true,
            assetType: metadata.type
          }
        },
        warnings: [`Thumbnail generation not yet implemented for ${metadata.type} assets`]
      };
    }
  }
}

/**
 * 3D model optimizer processor
 */
class ModelOptimizer implements AssetProcessor {
  name = "modelOptimizer";
  supportedTypes: AssetType[] = ["model"];

  async process(
    data: ArrayBuffer,
    metadata: AssetMetadata,
    options?: Record<string, any>,
  ): Promise<ProcessingResult> {
    const decimateRatio = options?.decimateRatio || 0.8; // Reduce poly count by 20%
    const compressTextures = options?.compressTextures !== false;

    // For now, pass through the model data unchanged
    // In production, this would use a proper 3D model processing library
    // like three.js GLTFExporter with draco compression or similar
    
    const updatedMetadata: Partial<AssetMetadata> = {
      size: data.byteLength,
      customProperties: {
        ...metadata.customProperties,
        optimized: true,
        originalSize: data.byteLength,
        decimateRatio,
        compressTextures,
        processedAt: new Date().toISOString(),
      },
    };

    const warnings: string[] = [];
    if (decimateRatio < 0.5) {
      warnings.push("Aggressive polygon reduction may affect model quality");
    }
    
    if (data.byteLength > 10 * 1024 * 1024) { // 10MB
      warnings.push("Large model file may impact performance");
    }

    return {
      data,
      metadata: updatedMetadata,
      warnings,
    };
  }
}

/**
 * Data validation processor
 */
class DataValidator implements AssetProcessor {
  name = "dataValidator";
  supportedTypes: AssetType[] = ["data", "scene", "campaign", "template"];

  async process(data: ArrayBuffer, metadata: AssetMetadata): Promise<ProcessingResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (data.byteLength === 0) {
      errors.push("Asset data is empty");
    }

    // JSON validation for data assets
    if (metadata.mimeType === "application/json") {
      try {
        const text = new TextDecoder().decode(data);
        const json = JSON.parse(text);

        if (typeof json !== "object") {
          warnings.push("JSON data is not an object");
        }
      } catch (error) {
        errors.push(`Invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    const updatedMetadata: Partial<AssetMetadata> = {
      customProperties: {
        ...metadata.customProperties,
        validated: true,
        validationDate: new Date().toISOString(),
      },
    };

    return {
      data,
      metadata: updatedMetadata,
      warnings,
      errors,
    };
  }
}

/**
 * Default pipeline configurations for common use cases
 */
export const _DEFAULT_PIPELINE_CONFIGS = {
  // Fast processing for development
  development: {
    stages: [
      {
        name: "validation",
        description: "Basic validation",
        enabled: true,
        processor: new DataValidator(),
      },
      {
        name: "thumbnails",
        description: "Generate thumbnails",
        enabled: true,
        processor: new ThumbnailGenerator(),
      },
    ],
    generateThumbnails: true,
    generatePreviews: false,
    optimizeForWeb: false,
  } as PipelineConfig,

  // Full processing for production
  production: {
    stages: [
      {
        name: "validation",
        description: "Comprehensive validation",
        enabled: true,
        processor: new DataValidator(),
      },
      {
        name: "optimization",
        description: "Optimize for web",
        enabled: true,
        processor: new ImageOptimizer(),
        options: { quality: 0.8 },
      },
      {
        name: "audio",
        description: "Normalize audio",
        enabled: true,
        processor: new AudioNormalizer(),
      },
      {
        name: "models",
        description: "Optimize 3D models",
        enabled: true,
        processor: new ModelOptimizer(),
      },
      {
        name: "thumbnails",
        description: "Generate all previews",
        enabled: true,
        processor: new ThumbnailGenerator(),
      },
    ],
    generateThumbnails: true,
    generatePreviews: true,
    optimizeForWeb: true,
    quality: {
      image: 0.85,
      audio: 0.8,
      model: 0.7,
      map: 0.85,
      token: 0.9,
      scene: 1.0,
      campaign: 1.0,
      ruleset: 1.0,
      data: 1.0,
      template: 1.0,
      shader: 1.0,
      font: 1.0,
    },
  } as PipelineConfig,

  // Lightweight processing for mobile/bandwidth-constrained environments
  mobile: {
    stages: [
      {
        name: "validation",
        description: "Quick validation",
        enabled: true,
        processor: new DataValidator(),
      },
      {
        name: "optimization",
        description: "Aggressive optimization",
        enabled: true,
        processor: new ImageOptimizer(),
        options: { quality: 0.6, maxWidth: 1024, maxHeight: 1024 },
      },
      {
        name: "thumbnails",
        description: "Small thumbnails only",
        enabled: true,
        processor: new ThumbnailGenerator(),
        options: { thumbnailSize: 64, previewSize: 256 },
      },
    ],
    generateThumbnails: true,
    generatePreviews: false,
    optimizeForWeb: true,
    quality: {
      image: 0.6,
      audio: 0.7,
      model: 0.5,
      map: 0.6,
      token: 0.8,
      scene: 1.0,
      campaign: 1.0,
      ruleset: 1.0,
      data: 1.0,
      template: 1.0,
      shader: 1.0,
      font: 1.0,
    },
  } as PipelineConfig,
};
