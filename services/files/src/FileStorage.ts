/**
 * File storage implementations for different storage backends
 */

import { AssetStorage } from './AssetManager';
import type { Buffer } from 'node:buffer';

import * as fs from 'fs/promises';
import * as path from 'path';

// Local file system storage
export class LocalFileStorage implements AssetStorage {
  private basePath: string;
  private baseUrl: string;

  constructor(basePath: string, baseUrl: string) {
    this.basePath = basePath;
    this.baseUrl = baseUrl;
  }

  async upload(key: string, data: Buffer, _contentType: string): Promise<string> {
    const filePath = path.join(this.basePath, key);
    const directory = path.dirname(filePath);
    
    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });
    
    // Write file
    await fs.writeFile(filePath, data);
    
    return `${this.baseUrl}/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    const filePath = path.join(this.basePath, key);
    return fs.readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    const filePath = path.join(this.basePath, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// S3-compatible storage
export class S3Storage implements AssetStorage {
  private bucketName: string;
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private endpoint: string | undefined;

  constructor(config: {
    bucketName: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  }) {
    this.bucketName = config.bucketName;
    this.region = config.region;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.endpoint = config.endpoint;
  }

  async upload(key: string, data: Buffer, contentType: string): Promise<string> {
    // Simplified S3 upload implementation
    // In production, use AWS SDK
    const url = this.getUrl(key);
    
    try {
      const response = await fetch(this.getUploadUrl(key), {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'Content-Length': data.length.toString(),
          'Authorization': this.getAuthHeader('PUT', key),
        },
        body: data as BodyInit,
      });

      if (!response.ok) {
        throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
      }

      return url;
    } catch (error) {
      throw new Error(`Failed to upload to S3: ${(error as Error).message}`);
    }
  }

  async download(key: string): Promise<Buffer> {
    try {
      const response = await fetch(this.getUrl(key), {
        headers: {
          'Authorization': this.getAuthHeader('GET', key),
        },
      });

      if (!response.ok) {
        throw new Error(`S3 download failed: ${response.status} ${response.statusText}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw new Error(`Failed to download from S3: ${(error as Error).message}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const response = await fetch(this.getUrl(key), {
        method: 'DELETE',
        headers: {
          'Authorization': this.getAuthHeader('DELETE', key),
        },
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`S3 delete failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Failed to delete from S3: ${(error as Error).message}`);
    }
  }

  getUrl(key: string): string {
    const baseUrl = this.endpoint || `https://s3.${this.region}.amazonaws.com`;
    return `${baseUrl}/${this.bucketName}/${key}`;
  }

  private getUploadUrl(key: string): string {
    return this.getUrl(key);
  }

  private extractStorageKey(url: string): string {
    // Extract storage key from URL - implementation depends on storage provider
    const key = url.split('/').pop();
    if (key === undefined) {
      throw new Error('Invalid URL: cannot extract storage key');
    }
    return key;
  }

  async exists(key: string): Promise<boolean> {
    try {
      const response = await fetch(this.getUrl(key), {
        method: 'HEAD',
        headers: {
          'Authorization': this.getAuthHeader('HEAD', key),
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private getAuthHeader(_method: string, _key: string): string {
    // Simplified AWS signature - in production use AWS SDK
    return `AWS ${this.accessKeyId}:${this.secretAccessKey}`;
  }
}

// In-memory storage for testing
export class MemoryStorage implements AssetStorage {
  private storage: Map<string, Buffer> = new Map();
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:3000/assets') {
    this.baseUrl = baseUrl;
  }

  async upload(key: string, data: Buffer, _contentType: string): Promise<string> {
    this.storage.set(key, data);
    return this.getUrl(key);
  }

  async download(key: string): Promise<Buffer> {
    const data = this.storage.get(key);
    if (!data) {
      throw new Error(`File not found: ${key}`);
    }
    return data;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  clear(): void {
    this.storage.clear();
  }

  size(): number {
    return this.storage.size;
  }
}
