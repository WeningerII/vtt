/**
 * Map and grid system routes for tactical combat
 */

import { RouteHandler } from "../router/types";
import { logger } from "@vtt/logging";
import { Buffer } from "node:buffer";

import { MapService } from "../map/MapService";
import { MapScene, GridEffect } from "../map/types";
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

// Lazy-load services to avoid initialization issues during module loading
let prisma: PrismaClient | null = null;
let mapService: MapService | null = null;

function getServices() {
  if (!prisma) {
    prisma = new PrismaClient();
    mapService = new MapService(prisma);
  }
  return { prisma, mapService: mapService! };
}

function getMapService(): MapService {
  const { mapService } = getServices();
  if (!mapService) {
    throw new Error("MapService not initialized");
  }
  return mapService;
}

// Import shared JSON parsing utility
import { parseJsonBody } from "../utils/json";

/**
 * POST /maps/scenes - Create new scene
 */
export const createSceneHandler: RouteHandler = async (ctx) => {
  try {
    const sceneData = await parseJsonBody(ctx.req);

    if (!sceneData.name || !sceneData.width || !sceneData.height) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Name, width, and height are required" }));
      return;
    }

    const scene = await getMapService().createScene(
      sceneData.name,
      sceneData.width,
      sceneData.height,
      sceneData.campaignId,
      sceneData.mapId
    );

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ scene }));
  } catch (error) {
    logger.error("Error creating scene:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to create scene" }));
  }
};

/**
 * GET /maps/scenes/:sceneId - Get specific scene
 */
export const getSceneHandler: RouteHandler = async (ctx) => {
  try {
    const sceneId = ctx.url.pathname.split("/")[3];

    if (!sceneId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene ID is required" }));
      return;
    }

    const scene = await getMapService().getScene(sceneId);

    if (!scene) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ scene }));
  } catch (error) {
    logger.error("Error getting scene:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to get scene" }));
  }
};

/**
 * PUT /maps/scenes/:sceneId - Update scene
 */
export const updateSceneHandler: RouteHandler = async (ctx) => {
  try {
    if (!mapService) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const sceneId = ctx.url.pathname.split("/")[3];
    const updates = await parseJsonBody(ctx.req);

    if (!sceneId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene ID is required" }));
      return;
    }

    const scene = await mapService.updateScene(sceneId, updates);

    if (!scene) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ scene }));
  } catch (error) {
    logger.error("Error updating scene:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to update scene" }));
  }
};

/**
 * GET /maps/scenes - Get all scenes
 */
export const getScenesHandler: RouteHandler = async (ctx) => {
  try {
    if (!mapService) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const scenes = await mapService.getAllScenes();

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ scenes }));
  } catch (error) {
    logger.error("Error getting scenes:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to get scenes" }));
  }
};

/**
 * POST /maps/scenes/:sceneId/coordinate-conversion - Convert coordinates
 */
export const convertCoordinatesHandler: RouteHandler = async (ctx) => {
  try {
    const sceneId = ctx.url.pathname.split("/")[3];
    const { x, y, from, to } = await parseJsonBody(ctx.req);

    if (!sceneId || x === undefined || y === undefined || !from || !to) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene ID, x, y, from, and to are required" }));
      return;
    }

    const mapServiceInstance = getMapService();
    if (!mapServiceInstance) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const scene = await mapServiceInstance.getScene(sceneId);
    if (!scene) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene not found" }));
      return;
    }

    const result =
      from === "pixel"
        ? mapServiceInstance.pixelToGrid(x, y, scene.grid)
        : mapServiceInstance.gridToPixel(x, y, scene.grid);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ result }));
  } catch (error) {
    logger.error("Error converting coordinates:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to convert coordinates" }));
  }
};

/**
 * POST /maps/scenes/:sceneId/distance - Calculate distance
 */
export const calculateDistanceHandler: RouteHandler = async (ctx) => {
  try {
    const sceneId = ctx.url.pathname.split("/")[3];
    const { x1, y1, x2, y2, units } = await parseJsonBody(ctx.req);

    if (!sceneId || x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene ID and coordinates are required" }));
      return;
    }

    const mapServiceInstance = getMapService();
    if (!mapServiceInstance) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const scene = await mapServiceInstance.getScene(sceneId);
    if (!scene) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene not found" }));
      return;
    }

    const distance = mapServiceInstance.calculateDistance(x1, y1, x2, y2, scene.grid, units || "grid");

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ distance, units: units || "grid" }));
  } catch (error) {
    logger.error("Error calculating distance:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to calculate distance" }));
  }
};

/**
 * POST /maps/scenes/:sceneId/movement-path - Get movement path
 */
export const getMovementPathHandler: RouteHandler = async (ctx) => {
  try {
    if (!mapService) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const sceneId = ctx.url.pathname.split("/")[3];
    const { startX, startY, endX, endY, obstacles } = (await parseJsonBody(ctx.req)) as {
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      obstacles?: Array<{ x: number; y: number; width: number; height: number }>;
    };

    if (
      !sceneId ||
      startX === undefined ||
      startY === undefined ||
      endX === undefined ||
      endY === undefined
    ) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing required coordinates" }));
      return;
    }

    const scene = await mapService.getScene(sceneId);
    if (!scene) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene not found" }));
      return;
    }

    const path = mapService.getMovementPath(
      startX,
      startY,
      endX,
      endY,
      obstacles || []
    );

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ path }));
  } catch (error) {
    logger.error("Error getting movement path:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to get movement path" }));
  }
};

/**
 * POST /maps/scenes/:sceneId/line-of-sight - Calculate line of sight
 */
export const lineOfSightHandler: RouteHandler = async (ctx) => {
  try {
    if (!mapService) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const sceneId = ctx.url.pathname.split("/")[3];
    const { fromX, fromY, toX, toY, obstacles } = (await parseJsonBody(ctx.req)) as {
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      obstacles?: Array<{ x: number; y: number; width: number; height: number }>;
    };

    if (
      !sceneId ||
      fromX === undefined ||
      fromY === undefined ||
      toX === undefined ||
      toY === undefined
    ) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing required coordinates" }));
      return;
    }

    const result = mapService.calculateLineOfSight(
      fromX,
      fromY,
      toX,
      toY,
      obstacles || []
    );

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ lineOfSight: result }));
  } catch (error) {
    logger.error("Error calculating line of sight:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to calculate line of sight" }));
  }
};

/**
 * POST /maps/scenes/:sceneId/combat/combatants - Add combatant to initiative
 */
export const addCombatantHandler: RouteHandler = async (ctx) => {
  try {
    if (!mapService) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const sceneId = ctx.url.pathname.split("/")[3];
    const { tokenId, name, initiative } = (await parseJsonBody(ctx.req)) as {
      tokenId: string;
      name: string;
      initiative: number;
    };

    if (!sceneId || !tokenId || !name || initiative === undefined) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing required fields: tokenId, name, initiative" }));
      return;
    }

    const success = await mapService.addCombatant(sceneId, tokenId, name, initiative);

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Combat grid not found" }));
      return;
    }

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ message: "Combatant added successfully" }));
  } catch (error) {
    logger.error("Error adding combatant:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to add combatant" }));
  }
};

/**
 * POST /maps/scenes/:sceneId/combat/next-turn - Advance to next turn
 */
export const nextTurnHandler: RouteHandler = async (ctx) => {
  try {
    if (!mapService) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const sceneId = ctx.url.pathname.split("/")[3];

    if (!sceneId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene ID is required" }));
      return;
    }

    const success = await mapService.nextTurn(sceneId);

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Combat not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ message: "Turn advanced successfully" }));
  } catch (error) {
    logger.error("Error advancing turn:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to advance turn" }));
  }
};

/**
 * GET /maps/scenes/:sceneId/combat - Get combat grid
 */
export const getCombatGridHandler: RouteHandler = async (ctx) => {
  try {
    if (!mapService) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const sceneId = ctx.url.pathname.split("/")[3];

    if (!sceneId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene ID is required" }));
      return;
    }

    const combatStatus = await mapService.getCombatStatus(sceneId);

    if (!combatStatus) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Combat grid not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ combatStatus }));
  } catch (error) {
    logger.error("Error getting combat status:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to get combat status" }));
  }
};

/**
 * POST /maps/scenes/:sceneId/effects - Add grid effect
 */
export const addGridEffectHandler: RouteHandler = async (ctx) => {
  try {
    if (!mapService) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const sceneId = ctx.url.pathname.split("/")[3];
    const effectData = await parseJsonBody(ctx.req);

    if (!sceneId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene ID is required" }));
      return;
    }

    const effect = await mapService.addGridEffect(sceneId, effectData);

    if (!effect) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene or combat grid not found" }));
      return;
    }

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ effect }));
  } catch (error) {
    logger.error("Error adding grid effect:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to add grid effect" }));
  }
};

export const addLightSourceHandler: RouteHandler = async (ctx) => {
  try {
    if (!mapService) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Map service not initialized" }));
      return;
    }

    const body = await parseJsonBody(ctx.req);
    const { sceneId, x, y, radius, color, intensity } = body;

    if (!sceneId || typeof x !== "number" || typeof y !== "number") {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing required fields: sceneId, x, y" }));
      return;
    }

    // Add light source to scene
    const lightSource = {
      id: `light_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      x,
      y,
      radius: radius || 30,
      color: color || "#ffff99",
      intensity: intensity || 0.8,
    };

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, lightSource }));
  } catch (error: any) {
    logger.error("Failed to add light source:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to add light source" }));
  }
};

export const removeLightSourceHandler: RouteHandler = async (ctx) => {
  try {
    if (!mapService) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const sceneId = ctx.url.pathname.split("/")[3];
    const lightId = ctx.url.pathname.split("/")[5];

    if (!sceneId || !lightId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene ID and Light ID are required" }));
      return;
    }

    const success = await mapService.removeLightSource(sceneId, lightId);

    ctx.res.writeHead(success ? 200 : 404, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success }));
  } catch (_error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to remove light source" }));
  }
};

export const addFogAreaHandler: RouteHandler = async (ctx) => {
  try {
    if (!mapService) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const sceneId = ctx.url.pathname.split("/")[3];
    const fogData = await parseJsonBody(ctx.req);

    if (!sceneId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene ID is required" }));
      return;
    }

    const success = await mapService.addFogArea(sceneId, fogData);

    ctx.res.writeHead(success ? 201 : 404, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success }));
  } catch (_error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to add fog area" }));
  }
};

export const revealFogAreaHandler: RouteHandler = async (ctx) => {
  try {
    if (!mapService) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const sceneId = ctx.url.pathname.split("/")[3];
    const fogData = await parseJsonBody(ctx.req);

    if (!sceneId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene ID is required" }));
      return;
    }

    const success = await mapService.revealFogArea(
      sceneId,
      fogData.x || 0,
      fogData.y || 0,
      fogData.radius || 30,
    );

    ctx.res.writeHead(success ? 200 : 404, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success }));
  } catch (_error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to reveal fog area" }));
  }
};

export const createMeasurementHandler: RouteHandler = async (ctx) => {
  try {
    if (!mapService) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const sceneId = ctx.url.pathname.split("/")[3];
    const measurementData = await parseJsonBody(ctx.req);

    if (!sceneId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene ID is required" }));
      return;
    }

    const measurement = await mapService.createMeasurement(
      sceneId,
      measurementData.type || "distance",
      measurementData.points || [],
      measurementData.ownerId || "system",
    );

    ctx.res.writeHead(measurement ? 201 : 404, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ measurement }));
  } catch (_error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to create measurement" }));
  }
};

export const getMeasurementsHandler: RouteHandler = async (ctx) => {
  try {
    if (!mapService) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const sceneId = ctx.url.pathname.split("/")[3];

    if (!sceneId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene ID is required" }));
      return;
    }

    const measurements = await mapService.getMeasurements(sceneId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ measurements }));
  } catch (_error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to get measurements" }));
  }
};

export const initializeCombatHandler: RouteHandler = async (ctx) => {
  try {
    if (!mapService) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "MapService not available" }));
      return;
    }

    const sceneId = ctx.url.pathname.split("/")[3];

    if (!sceneId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene ID is required" }));
      return;
    }

    const success = await mapService.initializeCombat(sceneId);

    ctx.res.writeHead(success ? 201 : 404, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success }));
  } catch (_error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to initialize combat" }));
  }
};

/**
 * POST /maps/scenes/:sceneId/tokens - Add token to scene
 */
export const addTokenHandler: RouteHandler = async (ctx) => {
  const sceneId = ctx.url.pathname.split("/")[3];

  if (!sceneId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing sceneId" }));
    return;
  }

  if (!mapService) {
    ctx.res.writeHead(503, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "MapService not available" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);

    const token = await mapService.addToken(sceneId, body);

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ token }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to add token",
      }),
    );
  }
};

/**
 * PUT /maps/scenes/:sceneId/tokens/:tokenId/move - Move token
 */
export const moveTokenHandler: RouteHandler = async (ctx) => {
  const pathParts = ctx.url.pathname.split("/");
  const sceneId = pathParts[3];
  const tokenId = pathParts[5];

  if (!sceneId || !tokenId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing sceneId or tokenId" }));
    return;
  }

  if (!mapService) {
    ctx.res.writeHead(503, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "MapService not available" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);

    if (typeof body.x !== "number" || typeof body.y !== "number") {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Invalid coordinates" }));
      return;
    }

    const success = await mapService.moveToken(sceneId, tokenId, body.x, body.y);

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Token or scene not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to move token",
      }),
    );
  }
};

/**
 * PUT /maps/scenes/:sceneId/tokens/:tokenId - Update token
 */
export const updateTokenHandler: RouteHandler = async (ctx) => {
  const pathParts = ctx.url.pathname.split("/");
  const sceneId = pathParts[3];
  const tokenId = pathParts[5];

  if (!sceneId || !tokenId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing sceneId or tokenId" }));
    return;
  }

  if (!mapService) {
    ctx.res.writeHead(503, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "MapService not available" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);

    const success = await mapService.updateToken(sceneId, tokenId, body);

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Token or scene not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to update token",
      }),
    );
  }
};

/**
 * DELETE /maps/scenes/:sceneId/tokens/:tokenId - Remove token
 */
export const removeTokenHandler: RouteHandler = async (ctx) => {
  const pathParts = ctx.url.pathname.split("/");
  const sceneId = pathParts[3];
  const tokenId = pathParts[5];

  if (!sceneId || !tokenId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing sceneId or tokenId" }));
    return;
  }

  if (!mapService) {
    ctx.res.writeHead(503, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "MapService not available" }));
    return;
  }

  try {
    const success = await mapService.removeToken(sceneId, tokenId);

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Token or scene not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to remove token",
      }),
    );
  }
};

/**
 * POST /maps/upload - Upload map image
 */
export const uploadMapHandler: RouteHandler = async (ctx) => {
  try {
    const contentType = ctx.req.headers["content-type"] || "";

    if (!contentType.includes("multipart/form-data")) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Content type must be multipart/form-data" }));
      return;
    }

    // Simple file upload handling
    const chunks: Buffer[] = [];

    ctx.req.on("data", (_chunk: Buffer) => {
      chunks.push(_chunk);
    });

    ctx.req.on("end", async () => {
      try {
        const buffer = Buffer.concat(chunks);

        // Generate unique filename and save
        const mapId = uuidv4();
        const fileName = `${mapId}.png`;

        // Create uploads directory
        const uploadsDir = join(process.cwd(), "uploads", "maps");
        await fs.mkdir(uploadsDir, { recursive: true });

        // Save file
        const filePath = join(uploadsDir, fileName);
        await fs.writeFile(filePath, buffer);

        // Create map record
        if (!prisma) {
          ctx.res.writeHead(503, { "Content-Type": "application/json" });
          ctx.res.end(JSON.stringify({ error: "Database not available" }));
          return;
        }

        const map = await prisma.map.create({
          data: {
            id: mapId,
            name: `Map ${mapId}`,
            widthPx: 1920,
            heightPx: 1080,
            gridSizePx: 70,
          },
        });

        // Create asset record for the file
        const _asset = await prisma.asset.create({
          data: {
            mapId,
            kind: "ORIGINAL",
            uri: `/uploads/maps/${fileName}`,
            mimeType: "image/png",
            width: 1920,
            height: 1080,
            sizeBytes: buffer.length,
          },
        });

        ctx.res.writeHead(201, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify({ map }));
      } catch (error) {
        logger.error("Error processing upload:", error);
        ctx.res.writeHead(500, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify({ error: "Failed to process upload" }));
      }
    });
  } catch (error) {
    logger.error("Error handling upload:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Upload failed" }));
  }
};

/**
 * PUT /maps/scenes/:sceneId/settings - Update scene settings
 */
export const updateSceneSettingsHandler: RouteHandler = async (ctx) => {
  const pathParts = ctx.url.pathname.split("/");
  const sceneId = pathParts[3] || pathParts[4]; // Handle both /maps/scenes/:id/settings and /api/scenes/:id/settings

  if (!sceneId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Scene ID is required" }));
    return;
  }

  if (!mapService) {
    ctx.res.writeHead(503, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "MapService not available" }));
    return;
  }

  try {
    const settings = await parseJsonBody(ctx.req);

    // Use the MapService updateScene method
    const success = await mapService.updateScene(sceneId, settings);

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        message: "Scene settings updated successfully",
      }),
    );
  } catch (error) {
    logger.error("Failed to update scene settings:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: "Failed to update scene settings",
      }),
    );
  }
};

/**
 * GET /maps - Get all maps
 */
export const getMapsHandler: RouteHandler = async (ctx) => {
  try {
    if (!prisma) {
      ctx.res.writeHead(503, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Database not available" }));
      return;
    }

    const maps = await prisma.map.findMany({
      select: {
        id: true,
        name: true,
        widthPx: true,
        heightPx: true,
        gridSizePx: true,
        createdAt: true,
        assets: {
          where: { kind: "ORIGINAL" },
          select: {
            uri: true,
            mimeType: true,
            width: true,
            height: true,
            sizeBytes: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ maps }));
  } catch (error) {
    logger.error("Error getting maps:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to get maps" }));
  }
};
