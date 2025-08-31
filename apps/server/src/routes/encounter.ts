/**
 * Encounter management REST API routes for Combat Tracker integration
 */

import { RouteHandler } from "../utils/router";
import { logger } from "@vtt/logging";
import { parseJsonBody } from "../utils/json";
import { ActorIntegrationService } from "../services/ActorIntegrationService";
import { CharacterService } from "../character/CharacterService";
import { MonsterService } from "../services/MonsterService";
import { PrismaClient } from "@prisma/client";

// Lazy-load services to avoid initialization issues during module loading
let prisma: PrismaClient | null = null;
let characterService: CharacterService | null = null;
let monsterService: MonsterService | null = null;
let actorService: ActorIntegrationService | null = null;

function getServices() {
  if (!prisma) {
    prisma = new PrismaClient();
    characterService = new CharacterService();
    monsterService = new MonsterService(prisma);
    actorService = new ActorIntegrationService(prisma, characterService, monsterService);
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

    const encounter = await actorService.createEncounter(name, campaignId, characterIds, monsters);

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, encounter }));
  } catch (error: any) {
    logger.error("Failed to create encounter:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to create encounter" }));
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

    const encounter = await actorService.getEncounter(encounterId);

    if (!encounter) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, encounter }));
  } catch (error: any) {
    logger.error("Failed to get encounter:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to get encounter" }));
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

    await actorService.startEncounter(encounterId);
    const encounter = await actorService.getEncounter(encounterId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, encounter }));
  } catch (error: any) {
    logger.error("Failed to start encounter:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to start encounter" }));
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

    await actorService.endEncounter(encounterId);
    const encounter = await actorService.getEncounter(encounterId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, encounter }));
  } catch (error: any) {
    logger.error("Failed to end encounter:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to end encounter" }));
  }
};

/**
 * PUT /encounters/:id/actors/:actorId/health
 * Update actor health
 */
export const updateActorHealthHandler: RouteHandler = async (ctx) => {
  try {
    const pathParts = ctx.url.pathname.split("/");
    const actorId = pathParts[pathParts.length - 2]; // /encounters/:id/actors/:actorId/health

    const body = await parseJsonBody(ctx.req);
    const { current, max, temporary = 0 } = body;

    if (typeof current !== "number" || typeof max !== "number") {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Current and max health values required" }));
      return;
    }

    await actorService.updateActorHealth(actorId, { current, max, temporary });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    logger.error("Failed to update actor health:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to update actor health" }));
  }
};

/**
 * POST /encounters/:id/actors/character
 * Add character to encounter
 */
export const addCharacterToEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const pathParts = ctx.url.pathname.split("/");
    const _encounterId = pathParts[2]; // /encounters/:id/actors/character

    const body = await parseJsonBody(ctx.req);
    const { characterId } = body;

    if (!characterId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Character ID required" }));
      return;
    }

    const actor = await actorService.createCharacterActor(characterId);
    const campaignId = ctx.url.searchParams.get("campaignId") || "default-campaign";
    const dbActorId = await actorService.createDatabaseActor(actor, campaignId);

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, actor: { ...actor, databaseId: dbActorId } }));
  } catch (error: any) {
    logger.error("Failed to add character to encounter:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to add character to encounter" }));
  }
};

/**
 * POST /encounters/:id/actors/monster
 * Add monster to encounter
 */
export const addMonsterToEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const pathParts = ctx.url.pathname.split("/");
    const _encounterId = pathParts[2]; // /encounters/:id/actors/monster

    const body = await parseJsonBody(ctx.req);
    const { monsterId, instanceName } = body;

    if (!monsterId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Monster ID required" }));
      return;
    }

    const actor = await actorService.createMonsterActor(monsterId, instanceName);
    const campaignId = ctx.url.searchParams.get("campaignId") || "default-campaign";
    const dbActorId = await actorService.createDatabaseActor(actor, campaignId);

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, actor: { ...actor, databaseId: dbActorId } }));
  } catch (error: any) {
    logger.error("Failed to add monster to encounter:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to add monster to encounter" }));
  }
};
