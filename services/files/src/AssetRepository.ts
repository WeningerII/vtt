/**
 * Asset repository implementations for different data stores
 */

import { Asset, AssetRepository, AssetSearchQuery } from './AssetManager';
import { logger } from '@vtt/logging';

// In-memory asset repository for development/testing
export class InMemoryAssetRepository implements AssetRepository {
  private assets: Map<string, Asset> = new Map();
  private nextId = 1;

  async create(assetData: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset> {
    const now = new Date();
    const asset: Asset = {
      ...assetData,
      id: `asset_${this.nextId++}`,
      createdAt: now,
      updatedAt: now,
    };

    this.assets.set(asset.id, asset);
    return asset;
  }

  async findById(id: string): Promise<Asset | null> {
    return this.assets.get(id) || null;
  }

  async findByOwner(ownerId: string, query?: AssetSearchQuery): Promise<Asset[]> {
    const assets = Array.from(this.assets.values()).filter(asset => asset.ownerId === ownerId);
    return this.applyQuery(assets, query);
  }

  async findByGame(gameId: string, query?: AssetSearchQuery): Promise<Asset[]> {
    const assets = Array.from(this.assets.values()).filter(asset => asset.gameId === gameId);
    return this.applyQuery(assets, query);
  }

  async search(query: AssetSearchQuery): Promise<Asset[]> {
    let assets = Array.from(this.assets.values());

    // Apply base filters
    if (query.ownerId) {
      assets = assets.filter(asset => asset.ownerId === query.ownerId);
    }

    if (query.gameId) {
      assets = assets.filter(asset => asset.gameId === query.gameId);
    }

    if (query.isPublic !== undefined) {
      assets = assets.filter(asset => asset.isPublic === query.isPublic);
    }

    return this.applyQuery(assets, query);
  }

  async update(id: string, updates: Partial<Asset>): Promise<Asset> {
    const asset = this.assets.get(id);
    if (!asset) {
      throw new Error('Asset not found');
    }

    const updatedAsset: Asset = {
      ...asset,
      ...updates,
      id: asset.id, // Prevent ID changes
      createdAt: asset.createdAt, // Prevent creation date changes
      updatedAt: new Date(),
    };

    this.assets.set(id, updatedAsset);
    return updatedAsset;
  }

  async delete(id: string): Promise<void> {
    if (!this.assets.has(id)) {
      throw new Error('Asset not found');
    }
    this.assets.delete(id);
  }

  async updateTags(id: string, tags: string[]): Promise<Asset> {
    return this.update(id, { tags });
  }

  private applyQuery(assets: Asset[], query?: AssetSearchQuery): Asset[] {
    if (!query) return assets;

    let filtered = assets;

    // Filter by type
    if (query.type) {
      filtered = filtered.filter(asset => asset.type === query.type);
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      filtered = filtered.filter(asset => 
        query.tags!.some(tag => asset.tags.includes(tag))
      );
    }

    // Search in name and tags
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filtered = filtered.filter(asset => 
        asset.name.toLowerCase().includes(searchLower) ||
        asset.originalName.toLowerCase().includes(searchLower) ||
        asset.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    
    return filtered.slice(offset, offset + limit);
  }

  // Utility methods for testing
  clear(): void {
    this.assets.clear();
    this.nextId = 1;
  }

  count(): number {
    return this.assets.size;
  }

  getAll(): Asset[] {
    return Array.from(this.assets.values());
  }
}

// Database asset repository (PostgreSQL/MySQL)
export class DatabaseAssetRepository implements AssetRepository {
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async create(assetData: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset> {
    // Simplified database implementation
    // In production, use proper ORM like Prisma, TypeORM, or raw SQL
    const now = new Date();
    const asset: Asset = {
      ...assetData,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };

    // Execute INSERT query
    await this.executeQuery(`
      INSERT INTO assets (
        id, name, original_name, type, mime_type, size, url, thumbnail_url,
        metadata, tags, owner_id, game_id, is_public, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      asset.id, asset.name, asset.originalName, asset.type, asset.mimeType,
      asset.size, asset.url, asset.thumbnailUrl, JSON.stringify(asset.metadata),
      JSON.stringify(asset.tags), asset.ownerId, asset.gameId, asset.isPublic,
      asset.createdAt, asset.updatedAt
    ]);

    return asset;
  }

  async findById(id: string): Promise<Asset | null> {
    const rows = await this.executeQuery(
      'SELECT * FROM assets WHERE id = ? LIMIT 1',
      [id]
    );

    return rows.length > 0 ? this.mapRowToAsset(rows[0]) : null;
  }

  async findByOwner(ownerId: string, query?: AssetSearchQuery): Promise<Asset[]> {
    const { sql,  params  } = this.buildQuery({
      ...query,
      ownerId,
    });

    const rows = await this.executeQuery(sql, params);
    return rows.map(row => this.mapRowToAsset(row));
  }

  async findByGame(gameId: string, query?: AssetSearchQuery): Promise<Asset[]> {
    const { sql,  params  } = this.buildQuery({
      ...query,
      gameId,
    });

    const rows = await this.executeQuery(sql, params);
    return rows.map(row => this.mapRowToAsset(row));
  }

  async search(query: AssetSearchQuery): Promise<Asset[]> {
    const { sql,  params  } = this.buildQuery(query);
    const rows = await this.executeQuery(sql, params);
    return rows.map(row => this.mapRowToAsset(row));
  }

  async update(id: string, updates: Partial<Asset>): Promise<Asset> {
    const setClauses: string[] = [];
    const params: any[] = [];

    // Build SET clause dynamically
    Object.entries(updates).forEach(([_key, _value]) => {
      if (_key === 'id' || _key === 'createdAt') return; // Skip immutable fields
      
      const columnName = this.camelToSnake(_key);
      setClauses.push(`${columnName} = ?`);
      
      if (_key === 'metadata' || _key === 'tags') {
        params.push(JSON.stringify(_value));
      } else {
        params.push(_value);
      }
    });

    setClauses.push('updated_at = ?');
    params.push(new Date());
    params.push(id);

    await this.executeQuery(
      `UPDATE assets SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('Asset not found after update');
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const result = await this.executeQuery('DELETE FROM assets WHERE id = ?', [id]);
    
    // In production, check actual database result format
    if (Array.isArray(result) && result.length === 0) {
      throw new Error('Asset not found');
    }
  }

  async updateTags(id: string, tags: string[]): Promise<Asset> {
    return this.update(id, { tags });
  }

  private buildQuery(query: AssetSearchQuery): { sql: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    let sql = 'SELECT * FROM assets WHERE 1=1';

    if (query.ownerId) {
      conditions.push('owner_id = ?');
      params.push(query.ownerId);
    }

    if (query.gameId) {
      conditions.push('game_id = ?');
      params.push(query.gameId);
    }

    if (query.type) {
      conditions.push('type = ?');
      params.push(query.type);
    }

    if (query.isPublic !== undefined) {
      conditions.push('is_public = ?');
      params.push(query.isPublic);
    }

    if (query.search) {
      conditions.push('(name LIKE ? OR original_name LIKE ? OR tags LIKE ?)');
      const searchPattern = `%${query.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (query.tags && query.tags.length > 0) {
      const tagConditions = query.tags.map(() => 'tags LIKE ?').join(' OR ');
      conditions.push(`(${tagConditions})`);
      query.tags.forEach(tag => params.push(`%"${tag}"%`));
    }

    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
      
      if (query.offset) {
        sql += ' OFFSET ?';
        params.push(query.offset);
      }
    }

    return { sql, params };
  }

  private mapRowToAsset(row: any): Asset {
    return {
      id: row.id,
      name: row.name,
      originalName: row.original_name,
      type: row.type,
      mimeType: row.mime_type,
      size: row.size,
      url: row.url,
      thumbnailUrl: row.thumbnail_url,
      metadata: JSON.parse(row.metadata || '{}'),
      tags: JSON.parse(row.tags || '[]'),
      ownerId: row.owner_id,
      gameId: row.game_id,
      isPublic: row.is_public,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private generateId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async executeQuery(sql: string, params: any[] = []): Promise<any[]> {
    // Simplified database query execution
    // In production, use proper database driver
    logger.info('Executing SQL:', sql, 'with params:', params);
    
    // Mock implementation
    return [];
  }
}
