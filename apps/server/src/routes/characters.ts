/**
 * Character management routes
 */

import { RouteHandler } from "../router/types";
import { CharacterService } from "../character/CharacterService";
import { extractUserIdFromToken } from "../utils/auth";
import { CreateCharacterRequest, UpdateCharacterRequest } from "../character/types";

// Global character service instance
const characterService = new CharacterService();

/**
 * POST /characters - Create a new character
 */
export const createCharacterHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);

    // Extract userId from authenticated session
    const authHeader = ctx.req.headers["authorization"];
    const userId = authHeader
      ? await extractUserIdFromToken(authHeader)
      : body.userId || "temp-user-id";

    if (!body.name || !body.race || !body.class) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing required fields: name, race, class" }));
      return;
    }

    const request: CreateCharacterRequest = {
      name: body.name,
      race: body.race,
      class: body.class,
      level: body.level,
      background: body.background,
      alignment: body.alignment,
      abilities: body.abilities,
      campaignId: body.campaignId,
      templateId: body.templateId,
    };

    const character = await characterService.createCharacter(userId, request);

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        character,
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to create character",
      }),
    );
  }
};

/**
 * GET /characters/:characterId - Get character by ID
 */
export const getCharacterHandler: RouteHandler = async (ctx) => {
  const characterId = ctx.url.pathname.split("/")[2];

  if (!characterId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing characterId" }));
    return;
  }

  try {
    const character = await characterService.getCharacter(characterId);

    if (!character) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Character not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ character }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to get character",
      }),
    );
  }
};

/**
 * GET /characters - Get characters for current user
 */
export const getUserCharactersHandler: RouteHandler = async (ctx) => {
  try {
    // TODO: Extract userId from authenticated session
    const userId = ctx.url.searchParams.get("userId") || "temp-user-id";

    const characters = await characterService.getCharactersByUser(userId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        characters,
        count: characters.length,
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to get characters",
      }),
    );
  }
};

/**
 * PUT /characters/:characterId - Update character
 */
export const updateCharacterHandler: RouteHandler = async (ctx) => {
  const characterId = ctx.url.pathname.split("/")[2];

  if (!characterId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing characterId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);

    // Extract userId from authenticated session
    const authHeader = ctx.req.headers["authorization"];
    const userId = authHeader
      ? await extractUserIdFromToken(authHeader)
      : body.userId || "temp-user-id";

    const update: UpdateCharacterRequest = {
      name: body.name,
      level: body.level,
      experience: body.experience,
      hitPoints: body.hitPoints,
      abilities: body.abilities,
      equipment: body.equipment,
      notes: body.notes,
      personality: body.personality,
    };

    const character = await characterService.updateCharacter(characterId, userId, update);

    if (!character) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Character not found or not authorized" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        character,
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to update character",
      }),
    );
  }
};

/**
 * DELETE /characters/:characterId - Delete character
 */
export const deleteCharacterHandler: RouteHandler = async (ctx) => {
  const characterId = ctx.url.pathname.split("/")[2];

  if (!characterId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing characterId" }));
    return;
  }

  try {
    // TODO: Extract userId from authenticated session
    const userId = ctx.url.searchParams.get("userId") || "temp-user-id";

    const success = await characterService.deleteCharacter(characterId, userId);

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
        error: error.message || "Failed to delete character",
      }),
    );
  }
};

/**
 * GET /character-templates - Get available character templates
 */
export const getCharacterTemplatesHandler: RouteHandler = async (ctx) => {
  try {
    const templates = characterService.getTemplates();

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        templates,
        count: templates.length,
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to get templates",
      }),
    );
  }
};

/**
 * POST /characters/:characterId/level-up - Level up character
 */
export const levelUpCharacterHandler: RouteHandler = async (ctx) => {
  const characterId = ctx.url.pathname.split("/")[2];

  if (!characterId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing characterId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);

    // Extract userId from authenticated session
    const authHeader = ctx.req.headers["authorization"];
    const userId = authHeader
      ? await extractUserIdFromToken(authHeader)
      : body.userId || "temp-user-id";

    const character = await characterService.getCharacter(characterId);

    if (!character || character.userId !== userId) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Character not found or not authorized" }));
      return;
    }

    // Level up logic
    const newLevel = character.level + 1;
    const hpIncrease = body.hpIncrease || Math.floor(Math.random() * 6) + 4; // Default d8 + CON

    const update: UpdateCharacterRequest = {
      level: newLevel,
      hitPoints: {
        max: character.hitPoints.max + hpIncrease,
        current: character.hitPoints.current + hpIncrease,
      },
    };

    const updatedCharacter = await characterService.updateCharacter(characterId, userId, update);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        character: updatedCharacter,
        levelUp: {
          oldLevel: character.level,
          newLevel,
          hpGained: hpIncrease,
        },
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to level up character",
      }),
    );
  }
};

/**
 * POST /characters/:characterId/rest - Take a rest (short or long)
 */
export const characterRestHandler: RouteHandler = async (ctx) => {
  const characterId = ctx.url.pathname.split("/")[2];

  if (!characterId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing characterId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);

    // Extract userId from authenticated session
    const authHeader = ctx.req.headers["authorization"];
    const userId = authHeader
      ? await extractUserIdFromToken(authHeader)
      : body.userId || "temp-user-id";
    const restType = body.restType || "short"; // 'short' or 'long'

    const character = await characterService.getCharacter(characterId);

    if (!character || character.userId !== userId) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Character not found or not authorized" }));
      return;
    }

    let update: UpdateCharacterRequest = {};

    if (restType === "long") {
      // Long rest: restore all HP and hit dice
      update.hitPoints = {
        current: character.hitPoints.max,
        temporary: 0,
      };
      // Restore hit dice (up to half total)
      const _restoredHitDice = Math.floor(character.hitDice.total / 2);
      update = {
        ...update,
        // Note: This would need to be handled in the character service
      };
    } else {
      // Short rest: can spend hit dice to heal
      const hitDiceSpent = body.hitDiceSpent || 1;
      const hitDieValue = parseInt(character.hitDice.type.substring(1)); // Extract number from 'd8'
      const healingRoll =
        Math.floor(Math.random() * hitDieValue) + 1 + (character.abilities.CON?.modifier || 0);

      const newHP = Math.min(character.hitPoints.current + healingRoll, character.hitPoints.max);
      const _newHitDice = Math.max(character.hitDice.current - hitDiceSpent, 0);

      update.hitPoints = {
        current: newHP,
      };
    }

    const updatedCharacter = await characterService.updateCharacter(characterId, userId, update);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        character: updatedCharacter,
        restType,
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to process rest",
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
        resolve(JSON.parse(body || "{}"));
      } catch (_error) {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

// Export character service for use elsewhere
export { characterService };
