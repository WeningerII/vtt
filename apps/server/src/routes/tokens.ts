/**
 * Token routes with service integration and error handling
 */

import { RouteHandler } from "../router/types";
import { TokenService } from "../services/TokenService";
import { handleRouteError, _validateRequired, validateEnum, _validateString, validateNumber, validateUUID, _validateCoordinates, NotFoundError } from "../middleware/errorHandler";

// GET /tokens - List tokens for a scene
export const listTokensHandler: RouteHandler = async (ctx) => {
  try {
    const sceneId = ctx.url.searchParams.get("sceneId");
    const actorId = ctx.url.searchParams.get("actorId") || undefined;
    const disposition = ctx.url.searchParams.get("disposition") as "FRIENDLY" | "NEUTRAL" | "HOSTILE" | "UNKNOWN" | undefined;
    const isVisible = ctx.url.searchParams.get("isVisible") === "true" ? true : 
                      ctx.url.searchParams.get("isVisible") === "false" ? false : undefined;
    const layer = ctx.url.searchParams.get("layer") ? parseInt(ctx.url.searchParams.get("layer")!) : undefined;
    const limit = parseInt(ctx.url.searchParams.get("limit") || "100");
    const offset = parseInt(ctx.url.searchParams.get("offset") || "0");

    if (!sceneId) {
      throw new NotFoundError("Scene", "missing sceneId parameter");
    }

    validateUUID(sceneId, "sceneId");
    if (actorId) validateUUID(actorId, "actorId");
    if (disposition) validateEnum(disposition, ["FRIENDLY", "NEUTRAL", "HOSTILE", "UNKNOWN"], "disposition");
    if (layer !== undefined) validateNumber(layer, "layer", { integer: true });

    const tokenService = new TokenService(ctx.prisma);
    const result = await tokenService.searchTokens({ sceneId, actorId, disposition, isVisible, layer, limit, offset });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify(result));
  } catch (error: any) {
    handleRouteError(ctx, error);
  }
};

// GET /tokens/:tokenId - Get token by ID
export const getTokenHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.tokenId || ctx.url.pathname.split("/")[2];
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing tokenId" }));
      return;
    }

    const token = await ctx.prisma.token.findUnique({
      where: { id },
      include: {
        actor: {
          include: {
            monster: true,
            character: true,
            appliedConditions: {
              include: {
                condition: true,
              },
            },
          },
        },
        asset: true,
        appliedConditions: {
          include: {
            condition: true,
          },
        },
      },
    });

    if (!token) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Token not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ token }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to get token" }));
  }
};

// POST /tokens - Create a new token
export const createTokenHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);
    
    if (!body?.name || !body?.sceneId || typeof body.x !== "number" || typeof body.y !== "number") {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing required fields: name, sceneId, x, y" }));
      return;
    }

    // Validate disposition enum if provided
    const validDispositions = ["FRIENDLY", "NEUTRAL", "HOSTILE", "UNKNOWN"];
    if (body.disposition && !validDispositions.includes(body.disposition)) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Invalid disposition. Must be FRIENDLY, NEUTRAL, HOSTILE, or UNKNOWN" }));
      return;
    }

    // Validate actorId exists if provided
    if (body.actorId) {
      const actor = await ctx.prisma.actor.findUnique({
        where: { id: body.actorId },
      });
      if (!actor) {
        ctx.res.writeHead(400, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify({ error: "Actor not found" }));
        return;
      }
    }

    // Validate assetId exists if provided
    if (body.assetId) {
      const asset = await ctx.prisma.asset.findUnique({
        where: { id: body.assetId },
      });
      if (!asset) {
        ctx.res.writeHead(400, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify({ error: "Asset not found" }));
        return;
      }
    }

    const tokenData: any = {
      name: body.name,
      sceneId: body.sceneId,
      x: body.x,
      y: body.y,
      width: body.width || 1,
      height: body.height || 1,
      rotation: body.rotation || 0,
      scale: body.scale || 1.0,
      disposition: body.disposition || "NEUTRAL",
      isVisible: body.isVisible !== false,
      isLocked: body.isLocked === true,
      layer: body.layer || 0,
    };

    if (body.actorId) tokenData.actorId = body.actorId;
    if (body.assetId) tokenData.assetId = body.assetId;

    const created = await ctx.prisma.token.create({
      data: tokenData,
      include: {
        actor: {
          include: {
            monster: true,
            character: true,
          },
        },
        asset: true,
      },
    });

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, token: created }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to create token" }));
  }
};

// POST /tokens/from-actor - Create token from actor
export const createTokenFromActorHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);
    
    if (!body?.actorId || !body?.sceneId || typeof body.x !== "number" || typeof body.y !== "number") {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing required fields: actorId, sceneId, x, y" }));
      return;
    }

    const actor = await ctx.prisma.actor.findUnique({
      where: { id: body.actorId },
      include: {
        monster: true,
        character: true,
      },
    });

    if (!actor) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Actor not found" }));
      return;
    }

    // Determine token size from monster statblock if available
    let width = 1;
    let height = 1;
    if (actor.monster?.statblock) {
      const statblock = actor.monster.statblock as any;
      const size = statblock.size;
      // Map D&D sizes to grid squares
      switch (size) {
        case "TINY": width = height = 0.5; break;
        case "SMALL": case "MEDIUM": width = height = 1; break;
        case "LARGE": width = height = 2; break;
        case "HUGE": width = height = 3; break;
        case "GARGANTUAN": width = height = 4; break;
        default: width = height = 1;
      }
    }

    // Determine disposition based on actor kind
    let disposition = "NEUTRAL";
    if (actor.kind === "PC") disposition = "FRIENDLY";
    else if (actor.kind === "MONSTER") disposition = "HOSTILE";

    const tokenData = {
      name: body.name || actor.name,
      sceneId: body.sceneId,
      actorId: actor.id,
      x: body.x,
      y: body.y,
      width: body.width || width,
      height: body.height || height,
      rotation: body.rotation || 0,
      scale: body.scale || 1.0,
      disposition: body.disposition || disposition,
      isVisible: body.isVisible !== false,
      isLocked: body.isLocked === true,
      layer: body.layer || 0,
    };

    if (body.assetId) tokenData.assetId = body.assetId;

    const created = await ctx.prisma.token.create({
      data: tokenData,
      include: {
        actor: {
          include: {
            monster: true,
            character: true,
          },
        },
        asset: true,
      },
    });

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, token: created }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to create token from actor" }));
  }
};

// PUT /tokens/:tokenId/move - Move token to new position
export const moveTokenHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.tokenId || ctx.url.pathname.split("/")[2];
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing tokenId" }));
      return;
    }

    const body = await parseJsonBody(ctx.req);
    
    if (typeof body.x !== "number" || typeof body.y !== "number") {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing or invalid x, y coordinates" }));
      return;
    }

    const data: any = {
      x: body.x,
      y: body.y,
    };

    // Optional rotation update
    if (typeof body.rotation === "number") {
      data.rotation = body.rotation;
    }

    const updated = await ctx.prisma.token.update({
      where: { id },
      data,
      include: {
        actor: {
          include: {
            monster: true,
            character: true,
          },
        },
        asset: true,
      },
    });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, token: updated }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to move token" }));
  }
};

// PUT /tokens/:tokenId - Update token
export const updateTokenHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.tokenId || ctx.url.pathname.split("/")[2];
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing tokenId" }));
      return;
    }

    const body = await parseJsonBody(ctx.req);
    const data: any = {};

    // Only update provided fields
    if (typeof body.name === "string") data.name = body.name;
    if (typeof body.x === "number") data.x = body.x;
    if (typeof body.y === "number") data.y = body.y;
    if (typeof body.width === "number") data.width = body.width;
    if (typeof body.height === "number") data.height = body.height;
    if (typeof body.rotation === "number") data.rotation = body.rotation;
    if (typeof body.scale === "number") data.scale = body.scale;
    if (typeof body.disposition === "string") data.disposition = body.disposition;
    if (typeof body.isVisible === "boolean") data.isVisible = body.isVisible;
    if (typeof body.isLocked === "boolean") data.isLocked = body.isLocked;
    if (typeof body.layer === "number") data.layer = body.layer;

    const updated = await ctx.prisma.token.update({
      where: { id },
      data,
      include: {
        actor: {
          include: {
            monster: true,
            character: true,
          },
        },
        asset: true,
      },
    });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, token: updated }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to update token" }));
  }
};

// DELETE /tokens/:tokenId - Delete token
export const deleteTokenHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.tokenId || ctx.url.pathname.split("/")[2];
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing tokenId" }));
      return;
    }

    await ctx.prisma.token.delete({ where: { id } });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to delete token" }));
  }
};

// Helper: parse JSON
async function parseJsonBody(req: any): Promise<any> {
  return new Promise((_resolve, __reject) => {
    let body = "";
    req.on("data", (_chunk: any) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : Record<string, any>);
      } catch (_err) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}
