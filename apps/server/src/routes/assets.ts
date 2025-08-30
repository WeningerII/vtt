/**
 * Asset management routes
 */

import type { RouteHandler } from '../router/types';
import type { IncomingMessage } from 'http';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import { parseJsonBody } from '../utils/json';
import { AssetUploadRequest, AssetUpdateRequest, AssetSearchQuery } from "../assets/types";
import { AssetService } from "../assets/AssetService";
import { getAuthenticatedUserId } from "../middleware/auth";
import * as formidable from 'formidable';

// Initialize real AssetService
const assetService = new AssetService(process.env.UPLOAD_PATH || './uploads');

/**
 * POST /assets/upload - Upload a new asset
 */
export const uploadAssetHandler: RouteHandler = async (ctx) => {
  try {
    const userId = getAuthenticatedUserId(ctx);
    
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB limit
      keepExtensions: true
    });

    const [fields, files] = await form.parse(ctx.req);
    
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'No file uploaded' }));
      return;
    }

    const name = Array.isArray(fields.name) ? fields.name[0] : fields.name;
    if (!name) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Missing asset name' }));
      return;
    }

    const request: AssetUploadRequest = {
      name,
      type: (Array.isArray(fields.type) ? fields.type[0] : fields.type) as any,
      description: Array.isArray(fields.description) ? fields.description[0] : fields.description,
      campaignId: Array.isArray(fields.campaignId) ? fields.campaignId[0] : fields.campaignId,
      isPublic: (Array.isArray(fields.isPublic) ? fields.isPublic[0] : fields.isPublic) === 'true',
      tags: fields.tags ? (Array.isArray(fields.tags) ? fields.tags : [fields.tags]) : []
    };

    // Read file buffer
    const fileBuffer = fs.readFileSync(file.filepath);

    const asset = await assetService.uploadAsset(
      userId,
      request,
      fileBuffer,
      file.originalFilename || 'unknown',
      file.mimetype || 'application/octet-stream'
    );
    
    ctx.res.writeHead(201, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      success: true,
      asset
    }));
  } catch (error: any) {
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      error: error.message || 'Failed to upload asset' 
    }));
  }
};

/**
 * GET /assets/:assetId - Get asset metadata
 */
export const getAssetHandler: RouteHandler = async (ctx) => {
  const assetId = ctx.url.pathname.split('/')[2];
  
  if (!assetId) {
    ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: 'Missing assetId' }));
    return;
  }

  try {
    const asset = await assetService.getAsset(assetId);
    
    if (!asset) {
      ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Asset not found' }));
      return;
    }

    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ asset }));
  } catch (error: any) {
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      error: error.message || 'Failed to get asset' 
    }));
  }
};

/**
 * GET /assets/:assetId/file - Download asset file
 */
export const downloadAssetHandler: RouteHandler = async (ctx) => {
  const assetId = ctx.url.pathname.split('/')[2];
  
  if (!assetId) {
    ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: 'Missing assetId' }));
    return;
  }

  try {
    const asset = await assetService.getAsset(assetId);
    const fileBuffer = await assetService.getAssetFile(assetId);
    
    if (!asset || !fileBuffer) {
      ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Asset file not found' }));
      return;
    }

    ctx.res.writeHead(200, {
      'Content-Type': asset.mimeType,
      'Content-Length': fileBuffer.length,
      'Content-Disposition': `inline; filename="${asset.originalFilename}"`
    });
    ctx.res.end(fileBuffer);
  } catch (error: any) {
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      error: error.message || 'Failed to download asset' 
    }));
  }
};

/**
 * GET /assets - Search assets
 */
export const searchAssetsHandler: RouteHandler = async (ctx) => {
  try {
    const query: AssetSearchQuery = {
      ...(ctx.url.searchParams.get('name') && { name: ctx.url.searchParams.get('name')! }),
      ...(ctx.url.searchParams.get('type') && { type: ctx.url.searchParams.get('type') as any }),
      ...(ctx.url.searchParams.get('userId') && { userId: ctx.url.searchParams.get('userId')! }),
      ...(ctx.url.searchParams.get('campaignId') && { campaignId: ctx.url.searchParams.get('campaignId')! }),
      ...(ctx.url.searchParams.has('isPublic') && { 
        isPublic: ctx.url.searchParams.get('isPublic') === 'true' 
      }),
      ...(ctx.url.searchParams.getAll('tags').length > 0 && { tags: ctx.url.searchParams.getAll('tags') }),
      limit: parseInt(ctx.url.searchParams.get('limit') || '50'),
      offset: parseInt(ctx.url.searchParams.get('offset') || '0')
    };

    const results = await assetService.searchAssets(query);
    
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify(results));
  } catch (error: any) {
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      error: error.message || 'Failed to search assets' 
    }));
  }
};

/**
 * PUT /assets/:assetId - Update asset metadata
 */
export const updateAssetHandler: RouteHandler = async (ctx) => {
  const assetId = ctx.url.pathname.split('/')[2];
  
  if (!assetId) {
    ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: 'Missing assetId' }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);
    
    const userId = getAuthenticatedUserId(ctx);
    
    const update: AssetUpdateRequest = {
      name: body.name,
      description: body.description,
      isPublic: body.isPublic,
      tags: body.tags,
      metadata: body.metadata
    };

    const asset = await assetService.updateAsset(assetId, userId, update);
    
    if (!asset) {
      ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Asset not found or not authorized' }));
      return;
    }

    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      success: true,
      asset
    }));
  } catch (error: any) {
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      error: error.message || 'Failed to update asset' 
    }));
  }
};

/**
 * DELETE /assets/:assetId - Delete asset
 */
export const deleteAssetHandler: RouteHandler = async (ctx) => {
  const assetId = ctx.url.pathname.split('/')[2];
  
  if (!assetId) {
    ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: 'Missing assetId' }));
    return;
  }

  try {
    const userId = getAuthenticatedUserId(ctx);
    
    const success = await assetService.deleteAsset(assetId, userId);
    
    if (!success) {
      ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Asset not found or not authorized' }));
      return;
    }

    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      error: error.message || 'Failed to delete asset' 
    }));
  }
};

/**
 * POST /assets/:assetId/create-token - Create token from image asset
 */
export const createTokenHandler: RouteHandler = async (ctx) => {
  const assetId = ctx.url.pathname.split('/')[2];
  
  if (!assetId) {
    ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: 'Missing assetId' }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);
    
    const userId = getAuthenticatedUserId(ctx);
    
    const tokenData = {
      gridSize: body.gridSize || 1,
      isPC: body.isPC || false,
      category: body.category || 'other',
      stats: body.stats
    };

    const token = await assetService.createToken(assetId, userId, tokenData);
    
    if (!token) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Failed to create token - asset must be an image' }));
      return;
    }

    ctx.res.writeHead(201, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      success: true,
      token
    }));
  } catch (error: any) {
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      error: error.message || 'Failed to create token' 
    }));
  }
};

/**
 * POST /assets/:assetId/create-map - Create map from image asset
 */
export const createMapHandler: RouteHandler = async (ctx) => {
  const assetId = ctx.url.pathname.split('/')[2];
  
  if (!assetId) {
    ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: 'Missing assetId' }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);
    
    const userId = getAuthenticatedUserId(ctx);
    
    const mapData = {
      gridType: body.gridType || 'square',
      gridSize: body.gridSize || 50,
      gridOffsetX: body.gridOffsetX || 0,
      gridOffsetY: body.gridOffsetY || 0,
      scenes: body.scenes
    };

    const map = await assetService.createMap(assetId, userId, mapData);
    
    if (!map) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Failed to create map - asset must be an image' }));
      return;
    }

    ctx.res.writeHead(201, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      success: true,
      map
    }));
  } catch (error: any) {
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      error: error.message || 'Failed to create map' 
    }));
  }
};

/**
 * GET /assets/stats - Get asset statistics
 */
export const getAssetStatsHandler: RouteHandler = async (ctx) => {
  try {
    const stats = assetService.getStats();
    
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ stats }));
  } catch (error: any) {
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      error: error.message || 'Failed to get asset stats' 
    }));
  }
};

/**
 * GET /assets/libraries - Get user's asset libraries
 */
export const getUserLibrariesHandler: RouteHandler = async (ctx) => {
  try {
    const userId = getAuthenticatedUserId(ctx);
    
    const libraries = await assetService.getUserLibraries(userId);
    
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      libraries,
      count: libraries.length 
    }));
  } catch (error: any) {
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      error: error.message || 'Failed to get libraries' 
    }));
  }
};

/**
 * POST /assets/libraries - Create new asset library
 */
export const createLibraryHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);
    
    const userId = getAuthenticatedUserId(ctx);
    
    if (!body.name) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Missing library name' }));
      return;
    }

    const library = await assetService.createLibrary(
      userId,
      body.name,
      body.description || '',
      body.isPublic || false
    );
    
    ctx.res.writeHead(201, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      success: true,
      library
    }));
  } catch (error: any) {
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ 
      error: error.message || 'Failed to create library' 
    }));
  }
};


// Export asset service for use elsewhere
export { assetService };
