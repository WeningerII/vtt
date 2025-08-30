/**
 * Asset Manager Tests
 * Comprehensive test suite for asset management functionality
 */

import { AssetManager, MemoryStorageProvider } from '../AssetManager';

describe('AssetManager', () => {
  let assetManager: AssetManager;
  let storageProvider: MemoryStorageProvider;

  beforeEach(() => {
    storageProvider = new MemoryStorageProvider();
    assetManager = new AssetManager({
      storageProvider,
      cacheSize: 100,
      enableVersioning: true,
    });
  });

  afterEach(async () => {
    await assetManager.clear();
  });

  describe('Asset Storage and Retrieval', () => {
    test('should store and retrieve assets', async () => {
      const assetData = {
        name: 'Test Image',
        type: 'image',
        tags: ['test', 'sample'],
        metadata: { format: 'png', width: 100, height: 100 },
      };

      const asset = await assetManager.addAsset('test-image.png', assetData);
      expect(asset.id).toBeDefined();
      expect(asset.name).toBe('Test Image');
      expect(asset.type).toBe('image');

      const retrieved = await assetManager.getAsset(asset.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Image');
    });

    test('should generate unique IDs for assets', async () => {
      const asset1 = await assetManager.addAsset('file1.png', { name: 'Asset 1', type: 'image' });
      const asset2 = await assetManager.addAsset('file2.png', { name: 'Asset 2', type: 'image' });

      expect(asset1.id).not.toBe(asset2.id);
    });

    test('should handle asset not found', async () => {
      const asset = await assetManager.getAsset('non-existent-id');
      expect(asset).toBeNull();
    });

    test('should list all assets', async () => {
      await assetManager.addAsset('asset1.png', { name: 'Asset 1', type: 'image' });
      await assetManager.addAsset('asset2.jpg', { name: 'Asset 2', type: 'image' });
      await assetManager.addAsset('sound1.mp3', { name: 'Sound 1', type: 'audio' });

      const assets = await assetManager.listAssets();
      expect(assets).toHaveLength(3);
      expect(assets.map(a => a.name)).toContain('Asset 1');
      expect(assets.map(a => a.name)).toContain('Asset 2');
      expect(assets.map(a => a.name)).toContain('Sound 1');
    });
  });

  describe('Asset Filtering and Search', () => {
    beforeEach(async () => {
      await assetManager.addAsset('image1.png', {
        name: 'Forest Scene',
        type: 'image',
        tags: ['forest', 'nature', 'outdoor'],
        metadata: { format: 'png', size: 1024 },
      });

      await assetManager.addAsset('image2.jpg', {
        name: 'Dungeon Map',
        type: 'image',
        tags: ['dungeon', 'indoor', 'map'],
        metadata: { format: 'jpg', size: 2048 },
      });

      await assetManager.addAsset('audio1.mp3', {
        name: 'Forest Sounds',
        type: 'audio',
        tags: ['forest', 'ambient', 'nature'],
        metadata: { format: 'mp3', duration: 120 },
      });
    });

    test('should filter assets by type', async () => {
      const imageAssets = await assetManager.searchAssets({ type: 'image' });
      expect(imageAssets).toHaveLength(2);
      expect(imageAssets.every(a => a.type === 'image')).toBe(true);

      const audioAssets = await assetManager.searchAssets({ type: 'audio' });
      expect(audioAssets).toHaveLength(1);
      expect(audioAssets[0].type).toBe('audio');
    });

    test('should filter assets by tags', async () => {
      const forestAssets = await assetManager.searchAssets({ tags: ['forest'] });
      expect(forestAssets).toHaveLength(2);
      expect(forestAssets.every(a => a.tags.includes('forest'))).toBe(true);

      const dungeonAssets = await assetManager.searchAssets({ tags: ['dungeon'] });
      expect(dungeonAssets).toHaveLength(1);
      expect(dungeonAssets[0].name).toBe('Dungeon Map');
    });

    test('should filter assets by multiple criteria', async () => {
      const forestImages = await assetManager.searchAssets({
        type: 'image',
        tags: ['forest'],
      });
      expect(forestImages).toHaveLength(1);
      expect(forestImages[0].name).toBe('Forest Scene');
    });

    test('should search assets by name', async () => {
      const results = await assetManager.searchAssets({ name: 'Forest' });
      expect(results).toHaveLength(2);
      expect(results.map(a => a.name)).toContain('Forest Scene');
      expect(results.map(a => a.name)).toContain('Forest Sounds');
    });

    test('should search assets by metadata', async () => {
      const pngAssets = await assetManager.searchAssets({
        metadata: { format: 'png' },
      });
      expect(pngAssets).toHaveLength(1);
      expect(pngAssets[0].name).toBe('Forest Scene');
    });
  });

  describe('Asset Updates and Deletion', () => {
    test('should update asset metadata', async () => {
      const asset = await assetManager.addAsset('test.png', {
        name: 'Original Name',
        type: 'image',
        tags: ['old'],
      });

      const updated = await assetManager.updateAsset(asset.id, {
        name: 'Updated Name',
        tags: ['new', 'updated'],
        metadata: { edited: true },
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.tags).toEqual(['new', 'updated']);
      expect(updated.metadata.edited).toBe(true);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(asset.updatedAt.getTime());
    });

    test('should delete assets', async () => {
      const asset = await assetManager.addAsset('delete-me.png', {
        name: 'To Delete',
        type: 'image',
      });

      expect(await assetManager.getAsset(asset.id)).not.toBeNull();

      await assetManager.deleteAsset(asset.id);

      expect(await assetManager.getAsset(asset.id)).toBeNull();
    });

    test('should handle update of non-existent asset', async () => {
      await expect(assetManager.updateAsset('non-existent', { name: 'New Name' }))
        .rejects.toThrow('Asset not found');
    });

    test('should handle deletion of non-existent asset', async () => {
      await expect(assetManager.deleteAsset('non-existent'))
        .rejects.toThrow('Asset not found');
    });
  });

  describe('Asset Dependencies', () => {
    test('should track asset dependencies', async () => {
      const texture = await assetManager.addAsset('texture.png', {
        name: 'Wall Texture',
        type: 'image',
      });

      const scene = await assetManager.addAsset('scene.json', {
        name: 'Dungeon Scene',
        type: 'scene',
        dependencies: [texture.id],
      });

      const dependencies = await assetManager.getDependencies(scene.id);
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0].id).toBe(texture.id);

      const dependents = await assetManager.getDependents(texture.id);
      expect(dependents).toHaveLength(1);
      expect(dependents[0].id).toBe(scene.id);
    });

    test('should prevent deletion of assets with dependents', async () => {
      const texture = await assetManager.addAsset('texture.png', {
        name: 'Wall Texture',
        type: 'image',
      });

      await assetManager.addAsset('scene.json', {
        name: 'Scene',
        type: 'scene',
        dependencies: [texture.id],
      });

      await expect(assetManager.deleteAsset(texture.id))
        .rejects.toThrow('Cannot delete asset with dependents');
    });

    test('should allow forced deletion of assets with dependents', async () => {
      const texture = await assetManager.addAsset('texture.png', {
        name: 'Wall Texture',
        type: 'image',
      });

      const scene = await assetManager.addAsset('scene.json', {
        name: 'Scene',
        type: 'scene',
        dependencies: [texture.id],
      });

      await assetManager.deleteAsset(texture.id, { force: true });

      // Texture should be deleted
      expect(await assetManager.getAsset(texture.id)).toBeNull();

      // Scene should still exist but dependency should be removed
      const updatedScene = await assetManager.getAsset(scene.id);
      expect(updatedScene?.dependencies).toHaveLength(0);
    });
  });

  describe('Asset Versioning', () => {
    test('should create versions when assets are updated', async () => {
      const asset = await assetManager.addAsset('versioned.png', {
        name: 'Versioned Asset',
        type: 'image',
        metadata: { version: 1 },
      });

      // Update to create new version
      await assetManager.updateAsset(asset.id, {
        metadata: { version: 2 },
      });

      const versions = await assetManager.getAssetVersions(asset.id);
      expect(versions).toHaveLength(2);
      expect(versions[0].metadata.version).toBe(1); // Original
      expect(versions[1].metadata.version).toBe(2); // Updated
    });

    test('should restore asset to previous version', async () => {
      const asset = await assetManager.addAsset('restore-test.png', {
        name: 'Original Name',
        type: 'image',
      });

      // Update asset
      await assetManager.updateAsset(asset.id, {
        name: 'Modified Name',
      });

      const versions = await assetManager.getAssetVersions(asset.id);
      const originalVersion = versions[0];

      // Restore to original version
      const restored = await assetManager.restoreAssetVersion(asset.id, originalVersion.version);
      expect(restored.name).toBe('Original Name');
    });

    test('should limit number of versions stored', async () => {
      // Create asset manager with version limit
      const limitedVersionManager = new AssetManager({
        storageProvider: new MemoryStorageProvider(),
        enableVersioning: true,
        maxVersions: 3,
      });

      const asset = await limitedVersionManager.addAsset('limited.png', {
        name: 'Asset',
        type: 'image',
      });

      // Make multiple updates
      for (let i = 1; i <= 5; i++) {
        await limitedVersionManager.updateAsset(asset.id, {
          metadata: { iteration: i },
        });
      }

      const versions = await limitedVersionManager.getAssetVersions(asset.id);
      expect(versions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Asset Caching', () => {
    test('should cache frequently accessed assets', async () => {
      const asset = await assetManager.addAsset('cached.png', {
        name: 'Cached Asset',
        type: 'image',
      });

      // Access asset multiple times
      await assetManager.getAsset(asset.id);
      await assetManager.getAsset(asset.id);
      await assetManager.getAsset(asset.id);

      const stats = assetManager.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    test('should evict assets from cache when limit reached', async () => {
      // Create manager with small cache
      const smallCacheManager = new AssetManager({
        storageProvider: new MemoryStorageProvider(),
        cacheSize: 2,
      });

      // Add more assets than cache size
      const asset1 = await smallCacheManager.addAsset('1.png', { name: 'Asset 1', type: 'image' });
      const asset2 = await smallCacheManager.addAsset('2.png', { name: 'Asset 2', type: 'image' });
      const asset3 = await smallCacheManager.addAsset('3.png', { name: 'Asset 3', type: 'image' });

      // Access all assets to populate cache
      await smallCacheManager.getAsset(asset1.id);
      await smallCacheManager.getAsset(asset2.id);
      await smallCacheManager.getAsset(asset3.id);

      const stats = smallCacheManager.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(2);
    });
  });

  describe('Bulk Operations', () => {
    test('should handle bulk asset import', async () => {
      const assetsData = [
        { filename: 'bulk1.png', data: { name: 'Bulk Asset 1', type: 'image' } },
        { filename: 'bulk2.png', data: { name: 'Bulk Asset 2', type: 'image' } },
        { filename: 'bulk3.mp3', data: { name: 'Bulk Asset 3', type: 'audio' } },
      ];

      const results = await assetManager.bulkAddAssets(assetsData);
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);

      const assets = await assetManager.listAssets();
      expect(assets).toHaveLength(3);
    });

    test('should handle bulk asset deletion', async () => {
      const asset1 = await assetManager.addAsset('del1.png', { name: 'Delete 1', type: 'image' });
      const asset2 = await assetManager.addAsset('del2.png', { name: 'Delete 2', type: 'image' });
      const _asset3 = await assetManager.addAsset('del3.png', { name: 'Keep', type: 'image' });

      const results = await assetManager.bulkDeleteAssets([asset1.id, asset2.id]);
      expect(results.every(r => r.success)).toBe(true);

      const remainingAssets = await assetManager.listAssets();
      expect(remainingAssets).toHaveLength(1);
      expect(remainingAssets[0].name).toBe('Keep');
    });

    test('should handle partial failures in bulk operations', async () => {
      const _asset1 = await assetManager.addAsset('exists.png', { name: 'Exists', type: 'image' });
      
      const assetsData = [
        { filename: 'new.png', data: { name: 'New Asset', type: 'image' } },
        { filename: 'exists.png', data: { name: 'Duplicate', type: 'image' } }, // Should fail
      ];

      const results = await assetManager.bulkAddAssets(assetsData);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
    });
  });

  describe('Asset Statistics and Analytics', () => {
    beforeEach(async () => {
      await assetManager.addAsset('image1.png', { name: 'Image 1', type: 'image', metadata: { size: 1000 } });
      await assetManager.addAsset('image2.jpg', { name: 'Image 2', type: 'image', metadata: { size: 2000 } });
      await assetManager.addAsset('audio1.mp3', { name: 'Audio 1', type: 'audio', metadata: { size: 5000 } });
      await assetManager.addAsset('scene1.json', { name: 'Scene 1', type: 'scene', metadata: { size: 500 } });
    });

    test('should provide asset statistics', async () => {
      const stats = await assetManager.getStats();
      
      expect(stats.totalAssets).toBe(4);
      expect(stats.assetsByType.image).toBe(2);
      expect(stats.assetsByType.audio).toBe(1);
      expect(stats.assetsByType.scene).toBe(1);
      expect(stats.totalSize).toBe(8500);
    });

    test('should track asset usage', async () => {
      const assets = await assetManager.listAssets();
      const imageAsset = assets.find(a => a.type === 'image');

      // Simulate asset usage
      await assetManager.recordAssetUsage(imageAsset!.id);
      await assetManager.recordAssetUsage(imageAsset!.id);

      const usage = await assetManager.getAssetUsage(imageAsset!.id);
      expect(usage.accessCount).toBe(2);
      expect(usage.lastAccessed).toBeDefined();
    });

    test('should identify unused assets', async () => {
      const assets = await assetManager.listAssets();
      
      // Mark one asset as used
      await assetManager.recordAssetUsage(assets[0].id);

      const unusedAssets = await assetManager.getUnusedAssets(new Date(Date.now() - 1000));
      expect(unusedAssets).toHaveLength(3); // 3 assets haven't been accessed recently
    });
  });

  describe('Events', () => {
    test('should emit events for asset operations', (done) => {
      let eventsReceived = 0;
      const expectedEvents = 3; // added, updated, deleted

      const eventHandler = () => {
        eventsReceived++;
        if (eventsReceived === expectedEvents) {
          done();
        }
      };

      assetManager.on('assetAdded', eventHandler);
      assetManager.on('assetUpdated', eventHandler);
      assetManager.on('assetDeleted', eventHandler);

      (async () => {
        const asset = await assetManager.addAsset('event-test.png', {
          name: 'Event Test',
          type: 'image',
        });
        
        await assetManager.updateAsset(asset.id, { name: 'Updated Name' });
        await assetManager.deleteAsset(asset.id);
      })();
    });

    test('should emit dependency events', (done) => {
      assetManager.on('dependencyAdded', (data) => {
        expect(data.assetId).toBeDefined();
        expect(data.dependencyId).toBeDefined();
        done();
      });

      (async () => {
        const texture = await assetManager.addAsset('texture.png', {
          name: 'Texture',
          type: 'image',
        });

        await assetManager.addAsset('scene.json', {
          name: 'Scene',
          type: 'scene',
          dependencies: [texture.id],
        });
      })();
    });
  });

  describe('Error Handling and Validation', () => {
    test('should validate asset data on creation', async () => {
      await expect(assetManager.addAsset('invalid.png', {
        name: '', // Empty name should be invalid
        type: 'image',
      })).rejects.toThrow();

      await expect(assetManager.addAsset('invalid2.png', {
        name: 'Valid Name',
        type: 'invalid-type' as any, // Invalid type
      })).rejects.toThrow();
    });

    test('should handle storage provider failures', async () => {
      // Mock storage provider to simulate failures
      const failingProvider = {
        ...storageProvider,
        store: jest.fn().mockRejectedValue(new Error('Storage failed')),
      };

      const failingManager = new AssetManager({
        storageProvider: failingProvider,
      });

      await expect(failingManager.addAsset('fail.png', {
        name: 'Will Fail',
        type: 'image',
      })).rejects.toThrow('Storage failed');
    });

    test('should handle concurrent modifications gracefully', async () => {
      const asset = await assetManager.addAsset('concurrent.png', {
        name: 'Concurrent Test',
        type: 'image',
      });

      // Simulate concurrent updates
      const updates = Array.from({_ length: 10 }, (_, _i) =>
        assetManager.updateAsset(asset.id, { metadata: { update: i } })
      );

      const results = await Promise.allSettled(updates);
      
      // At least some updates should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });
  });
});
