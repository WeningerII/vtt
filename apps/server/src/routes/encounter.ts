/**
import { getErrorMessage } from "../utils/errors";
 * Encounter management REST API routes for Combat Tracker integration
 */

import { RouteHandler } from "../router/types";
import { logger } from "@vtt/logging";
import { parseJsonBody } from "../utils/json";
import { ActorIntegrationService } from "../services/ActorIntegrationService";
import { CharacterService } from "../character/CharacterService";
import { MonsterService } from "../services/MonsterService";
import { DatabaseManager } from "../database/connection";

// Lazy-load services to avoid initialization issues during module loading
let prisma: any | null = null; // TODO: Type as PrismaClient after DatabaseManager typing
let characterService: CharacterService | null = null;
let monsterService: MonsterService | null = null;
let actorService: ActorIntegrationService | null = null;

function getServices() {
  if (!prisma) {
    prisma = DatabaseManager.getInstance();
    characterService = new CharacterService();
    monsterService = new MonsterService(prisma);
    actorService = new ActorIntegrationService(prisma);
  }
  return {
    prisma,
    characterService: characterService!,
    monsterService: monsterService!,
    actorService: actorService!,
  };
}

/**
 * POST /encounters
 * Create a new encounter with characters and monsters
 */
export const createEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);
    const { name, campaignId, characterIds = [], monsters = [] } = body;

    if (!name || !campaignId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Name and campaignId are required" }));
      return;
    }

    const { actorService } = getServices();
    const encounter = await actorService.createEncounter(name, campaignId, characterIds, monsters);

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify(encounter));
  } catch (error) {
    logger.error("Failed to create encounter:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to create encounter" }));
  }
};

/**
 * GET /encounters/:id
 * Get encounter with all actors and combat data
 */
export const getEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const pathParts = ctx.url.pathname.split("/");
    const encounterId = pathParts[pathParts.length - 1];

    if (!encounterId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter ID required" }));
      return;
    }

    const { actorService } = getServices();
    const encounter = await actorService.getEncounter(encounterId);

    if (!encounter) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, encounter }));
  } catch (error) {
    logger.error("Failed to get encounter:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to get encounter" }));
  }
};

/**
 * POST /encounters/:id/start
 * Start encounter combat
 */
export const startEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const pathParts = ctx.url.pathname.split("/");
    const encounterId = pathParts[pathParts.length - 2]; // /encounters/:id/start

    if (!encounterId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter ID required" }));
      return;
    }

    const { actorService } = getServices();
    await actorService.startEncounter(encounterId);
    const encounter = await actorService.getEncounter(encounterId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, encounter }));
  } catch (error) {
    logger.error("Failed to start encounter:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to start encounter" }));
  }
};

/**
 * POST /encounters/:id/end
 * End encounter combat
 */
export const endEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const pathParts = ctx.url.pathname.split("/");
    const encounterId = pathParts[pathParts.length - 2]; // /encounters/:id/end

    if (!encounterId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter ID required" }));
      return;
    }

    const { actorService } = getServices();
    await actorService.endEncounter(encounterId);
    const encounter = await actorService.getEncounter(encounterId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, encounter }));
  } catch (error) {
    logger.error("Failed to end encounter:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to end encounter" }));
  }
};

/**
 * PUT /encounters/:id/tokens/:tokenId/health
 * Update token health
 */
export const updateTokenHealthHandler: RouteHandler = async (ctx) => {
  try {
    const pathParts = ctx.url.pathname.split("/");
    const tokenId = pathParts[pathParts.length - 2]; // /encounters/:id/tokens/:tokenId/health

    const body = await parseJsonBody(ctx.req);
    const { current, max, temporary = 0 } = body;

    if (typeof current !== "number" || typeof max !== "number") {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Current and max health values required" }));
      return;
    }

    const { actorService } = getServices();
    await actorService.updateTokenHealth(tokenId, current);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error) {
    logger.error("Failed to update token health:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to update token health" }));
  }
};

/**
 * POST /encounters/:id/tokens/character
 * Add character token to encounter
 */
export const addCharacterToEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const pathParts = ctx.url.pathname.split("/");
    const encounterId = pathParts[2]; // /encounters/:id/tokens/character

    const body = await parseJsonBody(ctx.req);
    const { characterId, gameSessionId } = body;

    if (!characterId || !gameSessionId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Character ID and gameSessionId are required" }));
      return;
    }

    const { actorService, prisma } = getServices();
    const actor = await actorService.createCharacterActor(characterId);
    const tokenId = await actorService.createDatabaseToken(actor, gameSessionId);

    // Add token to encounter
    await prisma.encounterToken.create({
      data: {
        encounterId,
        tokenId,
        initiative: 10 + actor.abilities.DEX.modifier,
        isActive: true,
      },
    });

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, actor: { ...actor, tokenId } }));
  } catch (error) {
    logger.error("Failed to add character to encounter:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to add character to encounter" }));
  }
};

/**
 * POST /encounters/:id/tokens/monster
 * Add monster token to encounter
 */
export const addMonsterToEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const pathParts = ctx.url.pathname.split("/");
    const encounterId = pathParts[2]; // /encounters/:id/tokens/monster

    const body = await parseJsonBody(ctx.req);
    const { monsterId, instanceName, gameSessionId } = body;

    if (!monsterId || !gameSessionId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Monster ID and gameSessionId are required" }));
      return;
    }

    const { actorService, prisma } = getServices();
    const actor = await actorService.createMonsterActor(monsterId, instanceName);
    const tokenId = await actorService.createDatabaseToken(actor, gameSessionId);

    // Add token to encounter
    await prisma.encounterToken.create({
      data: {
        encounterId,
        tokenId,
        initiative: 10 + actor.abilities.DEX.modifier,
        isActive: true,
      },
    });

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, actor: { ...actor, tokenId } }));
  } catch (error) {
    logger.error("Failed to add monster to encounter:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to add monster to encounter" }));
  }
};

/**
 * POST /encounters/:id/actions
 * Execute combat action for an actor
 */
export const executeActionHandler: RouteHandler = async (ctx) => {
  try {
    const pathParts = ctx.url.pathname.split("/");
    const encounterId = pathParts[2]; // /encounters/:id/actions

    const body = await parseJsonBody(ctx.req);
    const { actorId, actionId, targetId } = body;

    if (!actorId || !actionId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Actor ID and action ID are required" }));
      return;
    }

    const { actorService } = getServices();
    const result = await actorService.executeAction(encounterId, actorId, actionId, targetId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, result }));
  } catch (error) {
    logger.error("Failed to execute action:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to execute action" }));
  }
};

/**
 * GET /encounters/:id/ai-decision/:actorId
 * Get AI tactical decision for NPC/Monster
 */
export const getAIDecisionHandler: RouteHandler = async (ctx) => {
  try {
    const pathParts = ctx.url.pathname.split("/");
    const encounterId = pathParts[2]; // /encounters/:id/ai-decision/:actorId
    const actorId = pathParts[4];

    if (!encounterId || !actorId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter ID and actor ID are required" }));
      return;
    }

    const { actorService } = getServices();
    const decision = await actorService.getAIDecision(encounterId, actorId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, decision }));
  } catch (error) {
    logger.error("Failed to get AI decision:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to get AI decision" }));
  }
};

/**
 * POST /encounters/:id/actors
 * Add an actor (character or monster) to encounter
 */
export const addActorHandler: RouteHandler = async (ctx) => {
  try {
    const { params } = ctx;
    const encounterId = params?.id;

    if (!encounterId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter ID is required" }));
      return;
    }

    const body = await parseJsonBody(ctx.req);
    const { type, characterId, monsterId, name, initiative } = body;

    if (!type || !["character", "monster"].includes(type)) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Actor type must be character or monster" }));
      return;
    }

    if (typeof initiative !== "number") {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Initiative must be a number" }));
      return;
    }

    const { actorService } = getServices();

    if (type === "character") {
      if (!characterId) {
        ctx.res.writeHead(400, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify({ error: "Character ID is required for character actors" }));
        return;
      }
      
      const actor = await actorService.addCharacterToEncounter(encounterId, characterId, initiative);
      ctx.res.writeHead(201, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify(actor));
    } else if (type === "monster") {
      if (!monsterId) {
        ctx.res.writeHead(400, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify({ error: "Monster ID is required for monster actors" }));
        return;
      }
      
      const actor = await actorService.addMonsterToEncounter(encounterId, monsterId, name || "Monster", initiative);
      ctx.res.writeHead(201, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify(actor));
    }
  } catch (error) {
    logger.error("Failed to add actor to encounter:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to add actor to encounter" }));
  }
};

/**
 * PUT /encounters/:id
 * Update encounter details
 */
export const updateEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const { params } = ctx;
    const encounterId = params?.id;

    if (!encounterId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter ID is required" }));
      return;
    }

    const body = await parseJsonBody(ctx.req);
    const { name, status, currentTurn, round } = body;

    // Validate status if provided
    if (status !== undefined && !["active", "inactive", "completed"].includes(status)) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Invalid encounter status" }));
      return;
    }

    // Validate turn and round numbers
    if ((currentTurn !== undefined && currentTurn < 0) || (round !== undefined && round < 1)) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Turn and round must be non-negative numbers" }));
      return;
    }

    const { actorService } = getServices();
    const updatedEncounter = await actorService.updateEncounter(encounterId, {
      name,
      status,
      currentTurn,
      round
    });

    if (!updatedEncounter) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify(updatedEncounter));
  } catch (error) {
    logger.error("Failed to update encounter:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to update encounter" }));
  }
};

/**
 * DELETE /encounters/:id
 * Delete an encounter
 */
export const deleteEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const { params } = ctx;
    const encounterId = params?.id;

    if (!encounterId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter ID is required" }));
      return;
    }

    const { actorService } = getServices();
    const deleted = await actorService.deleteEncounter(encounterId);

    if (!deleted) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter not found" }));
      return;
    }

    ctx.res.writeHead(204);
    ctx.res.end();
  } catch (error) {
    logger.error("Failed to delete encounter:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to delete encounter" }));
  }
};

/**
 * POST /encounters/:id/next-turn
 * Advance to next turn in combat
 */
export const nextTurnHandler: RouteHandler = async (ctx) => {
  try {
    const pathParts = ctx.url.pathname.split("/");
    const encounterId = pathParts[2]; // /encounters/:id/next-turn

    if (!encounterId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter ID is required" }));
      return;
    }

    const { actorService } = getServices();
    const result = await actorService.nextTurn(encounterId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, ...result }));
  } catch (error) {
    logger.error("Failed to advance turn:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to advance turn" }));
  }
};
