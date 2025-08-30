/**
 * Content Validation System
 * Validates assets, content packages, and enforces content policies
 */

import { AssetMetadata, AssetType, AssetCategory } from './AssetManager';
import { PackageManifest } from './ContentImporter';
import * as crypto from 'crypto';

export interface ValidationRule {
  name: string;
  description: string;
  type: 'warning' | 'error';
  validator: (context: ValidationContext) => ValidationResult;
}

export interface ValidationContext {
  asset?: AssetMetadata;
  data?: ArrayBuffer;
  manifest?: PackageManifest;
  filename?: string;
  mimeType?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}

export interface ContentPolicy {
  maxFileSize: number; // bytes
  maxTotalSize: number; // bytes for packages
  allowedTypes: AssetType[];
  allowedCategories: AssetCategory[];
  allowedMimeTypes: string[];
  blockedMimeTypes: string[];
  requireMetadata: string[]; // required metadata fields
  namePattern?: RegExp;
  tagRestrictions?: {
    required: string[];
    forbidden: string[];
    maxCount: number;
  };
  customRules?: ValidationRule[];
}

export class ContentValidator {
  private rules = new Map<string, ValidationRule>();
  private policy: ContentPolicy;

  constructor(policy: ContentPolicy) {
    this.policy = policy;
    this.setupDefaultRules();
    this.setupPolicyRules();
  }

  public async validateAsset(asset: AssetMetadata, data?: ArrayBuffer): Promise<ValidationResult> {
    const context: ValidationContext = { asset, data };
    return this.validate(context);
  }

  public async validateFile(filename: string, mimeType: string, data: ArrayBuffer): Promise<ValidationResult> {
    const context: ValidationContext = { filename, mimeType, data };
    return this.validate(context);
  }

  public async validatePackage(manifest: PackageManifest): Promise<ValidationResult> {
    const context: ValidationContext = { manifest };
    return this.validate(context);
  }

  public async validateIntegrity(asset: AssetMetadata, data: ArrayBuffer): Promise<ValidationResult> {
    const result: ValidationResult = { valid: true, issues: [] };
    
    try {
      // Calculate current checksum
      const currentChecksum = await this.calculateChecksum(data);
      
      // Compare with stored checksum
      if (asset.checksum && asset.checksum !== currentChecksum) {
        result.valid = false;
        result.issues.push({
          type: 'error',
          code: 'CHECKSUM_MISMATCH',
          message: 'Asset integrity check failed - checksum mismatch',
          suggestion: 'Re-upload the asset or verify the source file',
        });
      }
      
      // Verify file size matches
      if (asset.size !== data.byteLength) {
        result.valid = false;
        result.issues.push({
          type: 'error',
          code: 'SIZE_MISMATCH',
          message: 'Asset size does not match metadata',
          suggestion: 'Verify the asset file has not been corrupted',
        });
      }
      
    } catch (error) {
      result.valid = false;
      result.issues.push({
        type: 'error',
        code: 'INTEGRITY_CHECK_FAILED',
        message: `Integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
    
    return result;
  }

  private async validate(context: ValidationContext): Promise<ValidationResult> {
    const result: ValidationResult = { valid: true, issues: [] };

    // Run all validation rules
    for (const rule of this.rules.values()) {
      try {
        const ruleResult = rule.validator(context);
        
        if (!ruleResult.valid) {
          result.valid = false;
        }
        
        result.issues.push(...ruleResult.issues);
      } catch (error) {
        result.valid = false;
        result.issues.push({
          type: 'error',
          code: 'VALIDATION_ERROR',
          message: `Validation rule '${rule.name}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    return result;
  }

  public addRule(rule: ValidationRule): void {
    this.rules.set(rule.name, rule);
  }

  public removeRule(name: string): boolean {
    return this.rules.delete(name);
  }

  public getRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  private setupDefaultRules(): void {
    // File name validation
    this.rules.set('filename', {
      name: 'filename',
      description: 'Validates file names',
      type: 'error',
      validator: (context) => {
        const result: ValidationResult = { valid: true, issues: [] };
        const filename = context.filename || context.asset?.name;
        
        if (!filename) {
          return result;
        }

        // Check for dangerous characters
        if (/[<>:"/\\|?*\x00-\x1f]/.test(filename)) {
          result.issues.push({
            type: 'error',
            code: 'INVALID_FILENAME',
            message: 'Filename contains invalid characters',
            suggestion: 'Remove special characters from filename',
          });
          result.valid = false;
        }

        // Check length
        if (filename.length > 255) {
          result.issues.push({
            type: 'error',
            code: 'FILENAME_TOO_LONG',
            message: 'Filename is too long (max 255 characters)',
            suggestion: 'Shorten the filename',
          });
          result.valid = false;
        }

        return result;
      },
    });

    // File size validation
    this.rules.set('filesize', {
      name: 'filesize',
      description: 'Validates file sizes',
      type: 'warning',
      validator: (context) => {
        const result: ValidationResult = { valid: true, issues: [] };
        const size = context.data?.byteLength;
        
        if (!size) {
          return result;
        }

        // Check against policy max size
        if (size > this.policy.maxFileSize) {
          result.issues.push({
            type: 'error',
            code: 'FILE_TOO_LARGE',
            message: `File size ${this.formatBytes(size)} exceeds maximum ${this.formatBytes(this.policy.maxFileSize)}`,
            suggestion: 'Compress or reduce file size',
          });
          result.valid = false;
        }

        return result;
      },
    });

    // MIME type validation
    this.rules.set('mimetype', {
      name: 'mimetype',
      description: 'Validates MIME types',
      type: 'error',
      validator: (context) => {
        const result: ValidationResult = { valid: true, issues: [] };
        const mimeType = context.mimeType || context.asset?.mimeType;
        
        if (!mimeType) {
          return result;
        }

        // Check blocked MIME types
        if (this.policy.blockedMimeTypes.includes(mimeType)) {
          result.issues.push({
            type: 'error',
            code: 'BLOCKED_MIME_TYPE',
            message: `MIME type '${mimeType}' is not allowed`,
            suggestion: 'Use a different file format',
          });
          result.valid = false;
        }

        // Check allowed MIME types
        if (this.policy.allowedMimeTypes.length > 0 && !this.policy.allowedMimeTypes.includes(mimeType)) {
          result.issues.push({
            type: 'error',
            code: 'INVALID_MIME_TYPE',
            message: `MIME type '${mimeType}' is not in the allowed list`,
            suggestion: `Use one of: ${this.policy.allowedMimeTypes.join(', ')}`,
          });
          result.valid = false;
        }

        return result;
      },
    });
  }

  private setupPolicyRules(): void {
    // Asset type policy
    this.rules.set('policy_type', {
      name: 'policy_type',
      description: 'Enforces allowed asset types',
      type: 'error',
      validator: (context) => {
        const result: ValidationResult = { valid: true, issues: [] };
        const assetType = context.asset?.type;

        if (assetType && !this.policy.allowedTypes.includes(assetType)) {
          result.issues.push({
            type: 'error',
            code: 'TYPE_NOT_ALLOWED',
            message: `Asset type "${assetType}" is not allowed`,
            suggestion: `Allowed types: ${this.policy.allowedTypes.join(', ')}`,
          });
          result.valid = false;
        }

        return result;
      },
    });

    // Add custom rules if provided
    if (this.policy.customRules) {
      for (const rule of this.policy.customRules) {
        this.addRule(rule);
      }
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// Default content policy for VTT assets
export const DEFAULT_VTT_POLICY: ContentPolicy = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxTotalSize: 1024 * 1024 * 1024, // 1GB
  allowedTypes: [
    'image',
    'audio',
    'model',
    'map',
    'token',
    'scene',
  ],
  allowedCategories: [
    'characters',
    'environments',
    'items',
    'effects',
    'ui',
    'system',
  ],
  allowedMimeTypes: [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Audio
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/mp4',
    // Video
    'video/mp4',
    'video/webm',
    'video/ogg',
    // Documents
    'application/pdf',
    'text/plain',
    'text/markdown',
    // 3D Models
    'model/gltf+json',
    'model/gltf-binary',
    'application/octet-stream',
  ],
  blockedMimeTypes: [
    'application/x-executable',
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-winexe',
    'text/javascript',
    'application/javascript',
  ],
  requireMetadata: ['name', 'description'],
  namePattern: /^[a-zA-Z0-9_\-\s\.]+$/,
  tagRestrictions: {
    required: [],
    forbidden: ['nsfw', 'adult', 'explicit'],
    maxCount: 10,
  },
};
