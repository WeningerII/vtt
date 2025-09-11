/**
 * Campaign routes with comprehensive REST API
 * Provides full CRUD operations and campaign management
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Router import removed as it's not used in this file 
import {
  CampaignService,
  CreateCampaignRequest,
  UpdateCampaignRequest,
} from "../campaign/CampaignService";
import { MapService } from "../map/MapService";
import { DatabaseManager } from "../database/connection";
import { requireAuth, getAuthenticatedUserId as getAuthUserId } from "../middleware/auth";
import { RouteHandler, Context } from "../router/types";

// Lazy-load services to avoid initialization issues during module loading
let prisma: any | null = null;
let mapService: MapService | null = null;
let campaignService: CampaignService | null = null;

function getServices() {
  if (!prisma) {
    prisma = DatabaseManager.getInstance();
    mapService = new MapService(prisma);
    campaignService = new CampaignService(prisma, mapService);
  }
  return { prisma, mapService: mapService!, campaignService: campaignService! };
}

// Initialize services on first use
function getCampaignService(): CampaignService {
  const { campaignService } = getServices();
  return campaignService; // getServices() guarantees non-null campaignService
}

/**
 * Helper to get authenticated user ID from request
 */
function getAuthenticatedUserId(ctx: Context): string {
  return getAuthUserId(ctx);
}

/**
 * POST /campaigns - Create a new campaign
 */
export const createCampaignHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);
    const userId = getAuthenticatedUserId(ctx);

    if (!body.name) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing required field: name" }));
      return;
    }

    const request: CreateCampaignRequest = {
      name: body.name,
      description: body.description || "",
      gameSystem: body.gameSystem,
      isActive: body.isActive,
    };

    const campaign = await getCampaignService().createCampaign(userId, request);

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        campaign,
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to create campaign",
      }),
    );
  }
};

/**
 * GET /campaigns/:campaignId - Get campaign by ID
 */
export const getCampaignHandler: RouteHandler = async (ctx) => {
  const campaignId = ctx.url.pathname.split("/")[2];

  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId" }));
    return;
  }

  try {
    const campaign = await getCampaignService().getCampaign(campaignId);

    if (!campaign) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Campaign not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ campaign }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to get campaign",
      }),
    );
  }
};

/**
 * GET /campaigns - Get campaigns for current user
 */
export const getUserCampaignsHandler: RouteHandler = async (ctx) => {
  try {
    const userId = getAuthenticatedUserId(ctx);
    const asGM = ctx.url.searchParams.get("asGM") === "true";

    const campaigns = asGM
      ? await getCampaignService().getCampaignsAsMaster(userId)
      : await getCampaignService().getCampaignsForUser(userId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        campaigns,
        count: campaigns.length,
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to get campaigns",
      }),
    );
  }
};

/**
 * PUT /campaigns/:campaignId - Update campaign
 */
export const updateCampaignHandler: RouteHandler = async (ctx) => {
  const campaignId = ctx.url.pathname.split("/")[2];

  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);
    const userId = getAuthenticatedUserId(ctx);

    const update: UpdateCampaignRequest = {
      name: body.name,
      description: body.description,
      gameSystem: body.gameSystem,
      isActive: body.isActive,
      players: body.players,
      characters: body.characters,
    };

    const campaign = await getCampaignService().updateCampaign(campaignId, userId, update);

    if (!campaign) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Campaign not found or not authorized" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        campaign,
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to update campaign",
      }),
    );
  }
};

/**
 * DELETE /campaigns/:campaignId - Delete campaign
 */
export const deleteCampaignHandler: RouteHandler = async (ctx) => {
  const campaignId = ctx.url.pathname.split("/")[2];

  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId" }));
    return;
  }

  try {
    const userId = getAuthenticatedUserId(ctx);

    const success = await getCampaignService().deleteCampaign(campaignId, userId);

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Campaign not found or not authorized" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to delete campaign",
      }),
    );
  }
};

/**
 * GET /campaigns/:campaignId/players - Get players for campaign
 */
export const getCampaignPlayersHandler: RouteHandler = async (ctx) => {
  const campaignId = ctx.url.pathname.split("/")[2];

  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId" }));
    return;
  }

  try {
    const players = await getCampaignService().getCampaignPlayers(campaignId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ players }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to get campaign players",
      }),
    );
  }
};

/**
 * POST /campaigns/:campaignId/players - Add/Invite player to campaign
 */
export const addPlayerHandler: RouteHandler = async (ctx) => {
  const campaignId = ctx.url.pathname.split("/")[2];

  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);
    const userId = getAuthenticatedUserId(ctx);

    // Support both email-based invites and direct player ID addition
    if (body.email) {
      // Email-based invite
      const player = await getCampaignService().invitePlayerByEmail(
        campaignId, 
        userId, 
        body.email, 
        body.role || 'player'
      );

      ctx.res.writeHead(201, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ player }));
    } else if (body.playerId) {
      // Direct player addition
      const success = await getCampaignService().addPlayer(campaignId, userId, body.playerId);

      if (!success) {
        ctx.res.writeHead(409, { "Content-Type": "application/json" });
        ctx.res.end(
          JSON.stringify({ error: "Failed to add player - already exists or not authorized" }),
        );
        return;
      }

      ctx.res.writeHead(200, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ success: true }));
    } else {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing email or playerId" }));
      return;
    }
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to add player",
      }),
    );
  }
};

/**
 * PUT /campaigns/:campaignId/players/:playerId - Update player role/status
 */
export const updatePlayerHandler: RouteHandler = async (ctx) => {
  const pathParts = ctx.url.pathname.split("/");
  const campaignId = pathParts[2];
  const playerId = pathParts[4];

  if (!campaignId || !playerId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId or playerId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);
    const userId = getAuthenticatedUserId(ctx);

    const success = await getCampaignService().updatePlayer(campaignId, userId, playerId, {
      role: body.role,
      status: body.status
    });

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Player not found or not authorized" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to update player",
      }),
    );
  }
};

/**
 * DELETE /campaigns/:campaignId/players/:playerId - Remove player from campaign
 */
export const removePlayerHandler: RouteHandler = async (ctx) => {
  const pathParts = ctx.url.pathname.split("/");
  const campaignId = pathParts[2];
  const playerId = pathParts[4];

  if (!campaignId || !playerId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId or playerId" }));
    return;
  }

  try {
    const userId = getAuthenticatedUserId(ctx);

    const success = await getCampaignService().removePlayer(campaignId, userId, playerId);

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Player not found or not authorized" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to remove player",
      }),
    );
  }
};

/**
 * POST /campaigns/:campaignId/characters - Add character to campaign
 */
export const addCharacterToCampaignHandler: RouteHandler = async (ctx) => {
  const campaignId = ctx.url.pathname.split("/")[2];

  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);
    const userId = getAuthenticatedUserId(ctx);

    if (!body.characterId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing characterId" }));
      return;
    }

    const success = await getCampaignService().addCharacterToCampaign(campaignId, userId, body.characterId);

    if (!success) {
      ctx.res.writeHead(409, { "Content-Type": "application/json" });
      ctx.res.end(
        JSON.stringify({ error: "Failed to add character - already exists or not authorized" }),
      );
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to add character",
      }),
    );
  }
};

/**
 * DELETE /campaigns/:campaignId/characters/:characterId - Remove character from campaign
 */
export const removeCharacterFromCampaignHandler: RouteHandler = async (ctx) => {
  const pathParts = ctx.url.pathname.split("/");
  const campaignId = pathParts[2];
  const characterId = pathParts[4];

  if (!campaignId || !characterId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId or characterId" }));
    return;
  }

  try {
    const userId = getAuthenticatedUserId(ctx);

    const success = await getCampaignService().removeCharacterFromCampaign(campaignId, userId, characterId);

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Character not found or not authorized" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to remove character",
      }),
    );
  }
};

/**
 * POST /campaigns/:campaignId/archive - Archive campaign
 */
export const archiveCampaignHandler: RouteHandler = async (ctx) => {
  const campaignId = ctx.url.pathname.split("/")[2];

  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId" }));
    return;
  }

  try {
    const _body = await parseJsonBody(ctx.req);
    const userId = getAuthenticatedUserId(ctx);

    const success = await getCampaignService().archiveCampaign(campaignId, userId);

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Campaign not found or not authorized" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to archive campaign",
      }),
    );
  }
};

/**
 * GET /campaigns/:campaignId/stats - Get campaign statistics
 */
export const getCampaignStatsHandler: RouteHandler = async (ctx) => {
  const campaignId = ctx.url.pathname.split("/")[2];

  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId" }));
    return;
  }

  try {
    const stats = await getCampaignService().getCampaignStats(campaignId);

    if (!stats) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Campaign not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ stats }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to get campaign stats",
      }),
    );
  }
};

// Helper function to parse JSON from request body
async function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk: any) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

/**
 * GET /campaigns/:campaignId/scenes - Get scenes for campaign
 */
export const getCampaignScenesHandler: RouteHandler = async (ctx) => {
  const campaignId = ctx.url.pathname.split("/")[2];

  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId" }));
    return;
  }

  try {
    const campaignWithScenes = await getCampaignService().getCampaignWithScenes(campaignId);

    if (!campaignWithScenes) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Campaign not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        scenes: campaignWithScenes.scenes,
        activeSceneId: campaignWithScenes.activeSceneId,
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to get campaign scenes",
      }),
    );
  }
};

/**
 * POST /campaigns/:campaignId/scenes - Create scene for campaign
 */
export const createCampaignSceneHandler: RouteHandler = async (ctx) => {
  const campaignId = ctx.url.pathname.split("/")[2];

  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);
    const userId = getAuthenticatedUserId(ctx);

    if (!body.name) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing scene name" }));
      return;
    }

    const scene = await getCampaignService().createSceneForCampaign(
      campaignId,
      userId,
      body.name,
      body.mapId,
    );

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ scene }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to create scene",
      }),
    );
  }
};

/**
 * PUT /campaigns/:campaignId/active-scene - Set active scene
 */
export const setActiveCampaignSceneHandler: RouteHandler = async (ctx) => {
  const campaignId = ctx.url.pathname.split("/")[2];

  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);
    const userId = getAuthenticatedUserId(ctx);

    if (!body.sceneId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing sceneId" }));
      return;
    }

    const success = await getCampaignService().setActiveScene(campaignId, body.sceneId, userId);

    if (!success) {
      ctx.res.writeHead(403, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Unauthorized or invalid scene" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to set active scene",
      }),
    );
  }
};

/**
 * POST /campaigns/:campaignId/sessions - Start session
 */
export const startSessionHandler: RouteHandler = async (ctx) => {
  const campaignId = ctx.url.pathname.split("/")[2];

  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);
    const userId = getAuthenticatedUserId(ctx);

    if (!body.sceneId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing sceneId" }));
      return;
    }

    const session = await getCampaignService().startSession(campaignId, body.sceneId, userId);

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ session }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to start session",
      }),
    );
  }
};

/**
 * DELETE /campaigns/:campaignId/sessions/:sessionId - End session
 */
export const endSessionHandler: RouteHandler = async (ctx) => {
  const pathParts = ctx.url.pathname.split("/");
  const campaignId = pathParts[2];
  const sessionId = pathParts[4];

  if (!campaignId || !sessionId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId or sessionId" }));
    return;
  }

  try {
    const _body = await parseJsonBody(ctx.req);
    const userId = getAuthenticatedUserId(ctx);

    const success = await getCampaignService().endSession(sessionId, userId);

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Session not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to end session",
      }),
    );
  }
};

/**
 * GET /campaigns/:campaignId/sessions/active - Get active session
 */
export const getActiveSessionHandler: RouteHandler = async (ctx) => {
  const campaignId = ctx.url.pathname.split("/")[2];

  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId" }));
    return;
  }

  try {
    const session = await getCampaignService().getActiveSessionAsync(campaignId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ session }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to get active session",
      }),
    );
  }
};

/**
 * GET /campaigns/:campaignId/settings - Get campaign settings
 */
export const getCampaignSettingsHandler: RouteHandler = async (ctx) => {
  const campaignId = ctx.url.pathname.split("/")[2];

  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId" }));
    return;
  }

  try {
    const settings = await getCampaignService().getCampaignSettings(campaignId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ settings }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to get campaign settings",
      }),
    );
  }
};

/**
 * PUT /campaigns/:campaignId/settings - Update campaign settings
 */
export const updateCampaignSettingsHandler: RouteHandler = async (ctx) => {
  const campaignId = ctx.url.pathname.split("/")[2];

  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing campaignId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);
    const userId = getAuthenticatedUserId(ctx);

    const success = await getCampaignService().updateCampaignSettings(campaignId, userId, {
      isPublic: body.isPublic,
      allowSpectators: body.allowSpectators,
      maxPlayers: body.maxPlayers,
      autoAcceptInvites: body.autoAcceptInvites,
      requireApproval: body.requireApproval,
      sessionTimeout: body.sessionTimeout
    });

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Campaign not found or not authorized" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to update campaign settings",
      }),
    );
  }
};

// Export campaign service for use elsewhere
export { campaignService };
