/**
 * Asset management routes
 */

import type { RouteHandler } from "../router/types";
import * as fs from "fs";
import path from "path";
import { parseJsonBody } from "../utils/json";
import { getErrorMessage } from "../utils/errors";
import { AssetUploadRequest, AssetUpdateRequest, AssetSearchQuery } from "../assets/types";
import { AssetService } from "../assets/AssetService";
import { getAuthenticatedUserId } from "../middleware/auth";
import formidable, { type File as FormidableFile } from "formidable";

interface AssetUpdateBody {
  name?: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface TokenCreateBody {
  gridSize?: number;
  isPC?: boolean;
  category?: string;
  stats?: Record<string, unknown>;
}

interface MapCreateBody {
  gridType?: string;
  gridSize?: number;
  gridOffsetX?: number;
  gridOffsetY?: number;
  scenes?: unknown;
}

interface LibraryCreateBody {
  name?: string;
  description?: string;
  isPublic?: boolean;
}

// Initialize real AssetService
const assetService = new AssetService(process.env.UPLOAD_PATH || "./uploads");

/**
 * POST /assets/upload - Upload a new asset
 */
export const uploadAssetHandler: RouteHandler = async (ctx) => {
  try {
    const userId = getAuthenticatedUserId(ctx);

    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB limit
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(ctx.req);

    const uploaded = files.file;
    const file: FormidableFile | undefined = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    if (!file) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "No file uploaded" }));
      return;
    }

    // Enforce basic file constraints (size, type)
    const maxSize = 50 * 1024 * 1024; // 50MB
    const fileSize = file.size ?? fs.statSync(file.filepath).size;
    if (fileSize > maxSize) {
      ctx.res.writeHead(413, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Uploaded file too large", limitBytes: maxSize }));
      return;
    }

    const allowedMimeTypes = new Set<string>([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "audio/mpeg",
      "audio/ogg",
      "audio/wav",
    ]);
    if (!file.mimetype || !allowedMimeTypes.has(file.mimetype)) {
      ctx.res.writeHead(415, { "Content-Type": "application/json" });
      ctx.res.end(
        JSON.stringify({ error: "Unsupported media type", mimeType: file.mimetype || null }),
      );
      return;
    }

    const allowedExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp3", ".ogg", ".wav"]);
    const original = file.originalFilename || "";
    const ext = original ? path.extname(original).toLowerCase() : "";
    if (ext && !allowedExt.has(ext)) {
      ctx.res.writeHead(415, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Unsupported file extension", ext }));
      return;
    }

    const getFieldValue = (value: string | string[] | undefined): string | undefined =>
      Array.isArray(value) ? value[0] : value;

    const name = getFieldValue(fields.name as string | string[] | undefined);
    if (!name) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing asset name" }));
      return;
    }

    const request: AssetUploadRequest = {
      name,
      type: getFieldValue(
        fields.type as string | string[] | undefined,
      ) as AssetUploadRequest["type"],
      description: getFieldValue(fields.description as string | string[] | undefined),
      campaignId: getFieldValue(fields.campaignId as string | string[] | undefined),
      isPublic: getFieldValue(fields.isPublic as string | string[] | undefined) === "true",
      tags: (() => {
        const tagsField = fields.tags as string | string[] | undefined;
        if (!tagsField) {
          return [] as string[];
        }
        return Array.isArray(tagsField) ? tagsField : [tagsField];
      })(),
    };

    // Read file buffer
    const fileBuffer = fs.readFileSync(file.filepath);

    const asset = await assetService.uploadAsset(
      userId,
      request,
      fileBuffer,
      file.originalFilename || "unknown",
      file.mimetype || "application/octet-stream",
    );

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        asset,
      }),
    );
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: getErrorMessage(error) || "Failed to upload asset",
      }),
    );
  }
};

/**
 * GET /assets/:assetId - Get asset metadata
 */
export const getAssetHandler: RouteHandler = async (ctx) => {
  const assetId = ctx.url.pathname.split("/")[2];

  if (!assetId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing assetId" }));
    return;
  }

  try {
    const asset = await assetService.getAsset(assetId);

    if (!asset) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Asset not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ asset }));
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: getErrorMessage(error) || "Failed to get asset",
      }),
    );
  }
};

/**
 * GET /assets/:assetId/file - Download asset file
 */
export const downloadAssetHandler: RouteHandler = async (ctx) => {
  const assetId = ctx.url.pathname.split("/")[2];

  if (!assetId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing assetId" }));
    return;
  }

  try {
    const asset = await assetService.getAsset(assetId);
    const fileBuffer = await assetService.getAssetFile(assetId);

    if (!asset || !fileBuffer) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Asset file not found" }));
      return;
    }

    ctx.res.writeHead(200, {
      "Content-Type": asset.mimeType,
      "Content-Length": fileBuffer.length,
      "Content-Disposition": `inline; filename="${asset.originalFilename}"`,
    });
    ctx.res.end(fileBuffer);
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: getErrorMessage(error) || "Failed to download asset",
      }),
    );
  }
};

/**
 * GET /assets - Search assets
 */
export const searchAssetsHandler: RouteHandler = async (ctx) => {
  try {
    const query: AssetSearchQuery = {
      ...(ctx.url.searchParams.get("name") && { name: ctx.url.searchParams.get("name")! }),
      ...(ctx.url.searchParams.get("type") && {
        type: ctx.url.searchParams.get("type") as AssetSearchQuery["type"],
      }),
      ...(ctx.url.searchParams.get("userId") && { userId: ctx.url.searchParams.get("userId")! }),
      ...(ctx.url.searchParams.get("campaignId") && {
        campaignId: ctx.url.searchParams.get("campaignId")!,
      }),
      ...(ctx.url.searchParams.has("isPublic") && {
        isPublic: ctx.url.searchParams.get("isPublic") === "true",
      }),
      ...(ctx.url.searchParams.getAll("tags").length > 0 && {
        tags: ctx.url.searchParams.getAll("tags"),
      }),
      limit: parseInt(ctx.url.searchParams.get("limit") || "50"),
      offset: parseInt(ctx.url.searchParams.get("offset") || "0"),
    };

    const results = await assetService.searchAssets(query);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify(results));
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: getErrorMessage(error) || "Failed to search assets",
      }),
    );
  }
};

/**
 * PUT /assets/:assetId - Update asset metadata
 */
export const updateAssetHandler: RouteHandler = async (ctx) => {
  const assetId = ctx.url.pathname.split("/")[2];

  if (!assetId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing assetId" }));
    return;
  }

  try {
    const body = await parseJsonBody<AssetUpdateBody>(ctx.req);

    const userId = getAuthenticatedUserId(ctx);

    const update: AssetUpdateRequest = {
      name: body.name,
      description: body.description,
      isPublic: body.isPublic,
      tags: body.tags,
      metadata: body.metadata,
    };

    const asset = await assetService.updateAsset(assetId, userId, update);

    if (!asset) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Asset not found or not authorized" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        asset,
      }),
    );
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: getErrorMessage(error) || "Failed to update asset",
      }),
    );
  }
};

/**
 * DELETE /assets/:assetId - Delete asset
 */
export const deleteAssetHandler: RouteHandler = async (ctx) => {
  const assetId = ctx.url.pathname.split("/")[2];

  if (!assetId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing assetId" }));
    return;
  }

  try {
    const userId = getAuthenticatedUserId(ctx);

    const success = await assetService.deleteAsset(assetId, userId);

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Asset not found or not authorized" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: getErrorMessage(error) || "Failed to delete asset",
      }),
    );
  }
};

/**
 * POST /assets/:assetId/create-token - Create token from image asset
 */
export const createTokenHandler: RouteHandler = async (ctx) => {
  const assetId = ctx.url.pathname.split("/")[2];

  if (!assetId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing assetId" }));
    return;
  }

  try {
    const body = await parseJsonBody<TokenCreateBody>(ctx.req);

    const userId = getAuthenticatedUserId(ctx);

    const tokenData = {
      gridSize: body.gridSize || 1,
      isPC: body.isPC || false,
      category: body.category || "other",
      stats: body.stats,
    };

    const token = await assetService.createToken(assetId, userId, tokenData);

    if (!token) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Failed to create token - asset must be an image" }));
      return;
    }

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        token,
      }),
    );
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: getErrorMessage(error) || "Failed to create token",
      }),
    );
  }
};

/**
 * POST /assets/:assetId/create-map - Create map from image asset
 */
export const createMapHandler: RouteHandler = async (ctx) => {
  const assetId = ctx.url.pathname.split("/")[2];

  if (!assetId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing assetId" }));
    return;
  }

  try {
    const body = await parseJsonBody<MapCreateBody>(ctx.req);

    const userId = getAuthenticatedUserId(ctx);

    const mapData = {
      gridType: body.gridType || "square",
      gridSize: body.gridSize || 50,
      gridOffsetX: body.gridOffsetX || 0,
      gridOffsetY: body.gridOffsetY || 0,
      scenes: body.scenes,
    };

    const map = await assetService.createMap(assetId, userId, mapData);

    if (!map) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Failed to create map - asset must be an image" }));
      return;
    }

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        map,
      }),
    );
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: getErrorMessage(error) || "Failed to create map",
      }),
    );
  }
};

/**
 * GET /assets/stats - Get asset statistics
 */
export const getAssetStatsHandler: RouteHandler = async (ctx) => {
  try {
    const stats = assetService.getStats();

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ stats }));
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: getErrorMessage(error) || "Failed to get asset stats",
      }),
    );
  }
};

/**
 * GET /assets/libraries - Get user's asset libraries
 */
export const getUserLibrariesHandler: RouteHandler = async (ctx) => {
  try {
    const userId = getAuthenticatedUserId(ctx);

    const libraries = await assetService.getUserLibraries(userId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        libraries,
        count: libraries.length,
      }),
    );
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: getErrorMessage(error) || "Failed to get libraries",
      }),
    );
  }
};

/**
 * POST /assets/libraries - Create new asset library
 */
export const createLibraryHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody<LibraryCreateBody>(ctx.req);

    const userId = getAuthenticatedUserId(ctx);

    if (!body.name) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing library name" }));
      return;
    }

    const library = await assetService.createLibrary(
      userId,
      body.name,
      body.description || "",
      body.isPublic || false,
    );

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        library,
      }),
    );
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: getErrorMessage(error) || "Failed to create library",
      }),
    );
  }
};

// Export asset service for use elsewhere
export { assetService };
