/**
 * Crucible Combat AI API Routes
 */

import { z } from "zod";
import { logger } from "@vtt/logging";
import { DatabaseManager } from "../database/connection";
import { CrucibleService, type CombatCharacter, type TacticalContext } from "../ai/combat";
import { RouteHandler } from "../router/types";
import { parseJsonBody } from "../utils/json";
import { getErrorMessage } from "../utils/errors";

type TacticalDecisionInput = z.infer<typeof TacticalDecisionSchema>;
type CombatCharacterInput = TacticalDecisionInput["character"];
type ThreatLevel = TacticalContext["threatLevel"];

// Helper functions for combat calculations
function extractSpellSlots(character: CombatCharacterInput): Record<string, number> {
  if (character.spellSlots) {
    return character.spellSlots;
  }

  // Calculate based on class and level
  const spellSlots: Record<string, number> = {};
  const level = character.level || 1;
  const spellcaster = ["wizard", "sorcerer", "cleric", "druid", "bard", "warlock"].includes(
    character.class?.toLowerCase(),
  );

  if (spellcaster) {
    // Basic spell slot calculation
    if (level >= 1) {
      spellSlots["1"] = Math.min(4, 1 + Math.floor(level / 2));
    }
    if (level >= 3) {
      spellSlots["2"] = Math.min(3, Math.floor((level - 2) / 2));
    }
    if (level >= 5) {
      spellSlots["3"] = Math.min(3, Math.floor((level - 4) / 3));
    }
    if (level >= 7) {
      spellSlots["4"] = Math.min(3, Math.floor((level - 6) / 4));
    }
    if (level >= 9) {
      spellSlots["5"] = Math.min(2, Math.floor((level - 8) / 5));
    }
  }

  return spellSlots;
}

function calculateMovementSpeed(character: CombatCharacterInput): number {
  // Base movement speed
  let speed = character.speed ?? 30;

  // Adjust based on race
  const race = character.race?.toLowerCase();
  if (race === "dwarf" || race === "halfling" || race === "gnome") {
    speed = 25;
  } else if (race === "wood elf" || race === "elf") {
    speed = 35;
  }

  // Check for speed modifiers in equipment or abilities
  return speed;
}

function calculateThreatLevel(enemies: TacticalDecisionInput["enemies"]): ThreatLevel {
  if (!enemies || enemies.length === 0) {
    return "low";
  }

  // Calculate total challenge rating
  const totalCR = enemies.reduce((sum, enemy) => {
    const cr = enemy.challengeRating || enemy.cr || 0;
    return sum + (typeof cr === "string" ? parseFloat(cr) : cr);
  }, 0);

  // Determine threat level based on total CR
  if (totalCR < 2) {
    return "low";
  }
  if (totalCR < 5) {
    return "moderate";
  }
  if (totalCR < 10) {
    return "high";
  }
  return "extreme";
}

function toCombatCharacter(entity: any, team: "party" | "enemies"): CombatCharacter {
  const defaultPosition = entity.position ?? { x: 0, y: 0 };
  const abilities = entity.abilities ?? {};
  const stats = entity.stats ?? {};

  return {
    id: entity.id ?? `${team}-${entity.name ?? "combatant"}`,
    name: entity.name ?? "Unknown",
    type: entity.type ?? entity.class ?? team,
    class: entity.class,
    team,
    hitPoints: entity.hitPoints ?? stats.hitPoints?.current ?? 0,
    maxHitPoints: entity.maxHitPoints ?? stats.hitPoints?.max ?? entity.hitPoints ?? 0,
    armorClass: entity.armorClass ?? stats.armorClass ?? 10,
    position: defaultPosition,
    abilities,
    conditions: entity.conditions ?? [],
    initiative: entity.initiative ?? 0,
    spellSlots: entity.spellSlots ?? {},
    speed: entity.speed ?? stats.speed ?? 30,
    stats: entity.stats ?? undefined,
  };
}

// Lazy-load Prisma client to avoid initialization issues during module loading
let prisma: any | null = null;
let crucibleService: CrucibleService | null = null;

function getServices() {
  if (!prisma) {
    prisma = DatabaseManager.getInstance();
    crucibleService = new CrucibleService(prisma);
  }
  return { prisma, crucibleService: crucibleService! };
}

// Validation schemas
const TacticalDecisionSchema = z.object({
  character: z.object({
    id: z.string(),
    name: z.string(),
    class: z.string(),
    level: z.number(),
    hitPoints: z.number(),
    maxHitPoints: z.number(),
    armorClass: z.number(),
    race: z.string().optional(),
    abilities: z.object({
      strength: z.number(),
      dexterity: z.number(),
      constitution: z.number(),
      intelligence: z.number(),
      wisdom: z.number(),
      charisma: z.number(),
    }),
    speed: z.number().optional(),
    spellSlots: z.record(z.string(), z.number()).optional(),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
    spells: z.array(z.string()).optional(),
    equipment: z.array(z.string()).optional(),
  }),
  allies: z.array(z.any()),
  enemies: z.array(z.any()),
  battlefield: z.object({
    terrain: z.array(z.string()),
    hazards: z.array(z.any()),
    cover: z.array(z.any()),
    lighting: z.enum(["bright", "dim", "dark"]),
    weather: z.string().optional(),
  }),
  objectives: z.array(z.string()).optional(),
});

const CombatSimulationSchema = z.object({
  party: z.array(z.any()),
  enemies: z.array(z.any()),
  battlefield: z.object({
    terrain: z.array(z.string()),
    hazards: z.array(z.any()),
    cover: z.array(z.any()),
    lighting: z.enum(["bright", "dim", "dark"]),
    weather: z.string().optional(),
  }),
  maxRounds: z.number().min(1).max(50).optional(),
});

const PositionAnalysisSchema = z.object({
  character: z.object({
    id: z.string(),
    name: z.string(),
    class: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
  }),
  battlefield: z.object({
    terrain: z.array(z.string()),
    hazards: z.array(z.any()),
    cover: z.array(z.any()),
    lighting: z.enum(["bright", "dim", "dark"]),
  }),
  allies: z.array(z.any()),
  enemies: z.array(z.any()),
});

/**
 * POST /combat/tactical-decision
 * Get AI tactical recommendation for NPC
 */
export const getTacticalDecisionHandler: RouteHandler = async (ctx) => {
  try {
    // Check authentication
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    // Parse and validate request body
    let body;
    try {
      body = await parseJsonBody(ctx.req);
    } catch (_error) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    const validatedData = TacticalDecisionSchema.parse(body);

    // Build tactical context
    const tacticalContext = {
      character: validatedData.character,
      allies: validatedData.allies,
      enemies: validatedData.enemies,
      battlefield: {
        ...validatedData.battlefield,
        weather: validatedData.battlefield.weather || "clear",
      },
      resources: {
        spellSlots: extractSpellSlots(validatedData.character),
        hitPoints: validatedData.character.hitPoints,
        actionEconomy: {
          action: true,
          bonusAction: true,
          reaction: true,
          movement: calculateMovementSpeed(validatedData.character),
        },
      },
      objectives: validatedData.objectives || ["Defeat enemies"],
      threatLevel: calculateThreatLevel(validatedData.enemies) as
        | "low"
        | "moderate"
        | "high"
        | "extreme",
    };

    // Get tactical decision from Crucible AI service
    const decision = await crucibleService!.makeTacticalDecision(tacticalContext as any);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        data: decision,
      }),
    );
  } catch (error) {
    logger.error("Tactical decision failed:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: false,
        error: "Failed to generate tactical decision",
        details: getErrorMessage(error),
      }),
    );
  }
};

/**
 * POST /combat/simulate
 * Run complete combat simulation
 */
export const simulateCombatHandler: RouteHandler = async (ctx) => {
  try {
    // Check authentication
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    // Parse and validate request body
    let body;
    try {
      body = await parseJsonBody(ctx.req);
    } catch (_error) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    const { party, enemies, battlefield, maxRounds = 20 } = CombatSimulationSchema.parse(body);

    // Ensure battlefield has all required properties
    const battlefieldWithDefaults = {
      ...battlefield,
      weather: battlefield.weather || "clear",
    };

    // Run combat simulation
    const simulation = await crucibleService!.simulateCombat(
      party,
      enemies,
      battlefieldWithDefaults,
      maxRounds,
    );

    // Return simulation results
    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        data: {
          simulationId: simulation.id,
          winner: simulation.winner,
          rounds: simulation.rounds,
          casualties: simulation.casualties,
          tacticalAnalysis: simulation.tacticalAnalysis,
          isComplete: simulation.isComplete,
        },
      }),
    );
  } catch (error) {
    logger.error("Combat simulation failed:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: false,
        error: "Failed to simulate combat",
        details: getErrorMessage(error),
      }),
    );
  }
};

// ... (rest of the code remains the same)

/**
 * POST /combat/analyze
 * Analyze combat performance and provide insights
 */
export const analyzeCombatHandler: RouteHandler = async (ctx) => {
  try {
    // Check authentication
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    // Parse request body
    let body;
    try {
      body = await parseJsonBody(ctx.req);
    } catch (_error) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    const { combatLog } = body;

    if (!combatLog || !Array.isArray(combatLog)) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Valid combat log required" }));
      return;
    }

    // Analyze combat log using CrucibleService
    const { crucibleService } = getServices();
    const analysis = await crucibleService!.analyzeCombatPerformance(combatLog);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        data: analysis,
      }),
    );
  } catch (error) {
    logger.error("Combat analysis failed:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: false,
        error: "Failed to analyze combat",
        details: getErrorMessage(error),
      }),
    );
  }
};

/**
 * GET /combat/simulations
 * Get all active combat simulations
 */
export const getActiveSimulationsHandler: RouteHandler = async (ctx) => {
  try {
    // Check authentication
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    // Get active simulations from CrucibleService
    const { crucibleService } = getServices();
    const simulations = await crucibleService!.getAllActiveSimulations();

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        data: simulations.map((sim) => ({
          id: sim.id,
          participants: 0, // Not tracking participants in basic implementation
          rounds: sim.rounds,
          currentRound: sim.rounds, // Use total rounds as current round for completed simulations
          winner: sim.winner,
          isComplete: sim.isComplete,
        })),
      }),
    );
  } catch (error) {
    logger.error("Failed to get active simulations:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: false,
        error: "Failed to get simulations",
        details: getErrorMessage(error),
      }),
    );
  }
};

/**
 * WebSocket events for real-time combat updates
 */
export const _handleCombatWebSocket = async (
  ws: any,
  message: Record<string, unknown>,
  _userId: string,
) => {
  const payload =
    typeof message.payload === "object" && message.payload !== null
      ? (message.payload as Record<string, any>)
      : {};

  switch (message.type) {
    case "COMBAT_SUBSCRIBE":
      {
        const simulationId =
          typeof payload.simulationId === "string" ? payload.simulationId : undefined;

        // Subscribe to combat updates
        ws.combatSubscription = simulationId ?? null;

        // Send current status
        try {
          const { crucibleService } = getServices();
          const simulation = simulationId
            ? await crucibleService!.getSimulation(simulationId)
            : null;

          ws.send(
            JSON.stringify({
              type: "COMBAT_UPDATE",
              payload: simulation || {
                simulationId,
                currentRound: 0,
                participants: [],
                winner: null,
                isComplete: false,
                message: "Simulation not found",
              },
            }),
          );
        } catch (error) {
          ws.send(
            JSON.stringify({
              type: "COMBAT_ERROR",
              payload: { error: "Failed to get simulation status" },
            }),
          );
        }
      }
      break;

    case "COMBAT_UNSUBSCRIBE":
      ws.combatSubscription = null;
      break;

    case "REQUEST_TACTICAL_DECISION":
      {
        // Real-time tactical decision request
        const context = payload.context;

        try {
          const { crucibleService } = getServices();
          const decision = await crucibleService!.makeTacticalDecision(context as any);

          ws.send(
            JSON.stringify({
              type: "TACTICAL_DECISION",
              payload: {
                requestId: payload.requestId,
                decision,
              },
            }),
          );
        } catch (error) {
          ws.send(
            JSON.stringify({
              type: "TACTICAL_DECISION_ERROR",
              payload: {
                requestId: payload.requestId,
                error: "Failed to generate tactical decision",
              },
            }),
          );
        }
      }
      break;
  }
};

/**
 * GET /combat/simulation/:simulationId
 * Get specific combat simulation details
 */
export const getSimulationHandler: RouteHandler = async (ctx) => {
  try {
    // Check authentication
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    // Extract simulation ID from URL path
    const pathParts = ctx.url.pathname.split("/");
    const simulationId = pathParts[pathParts.length - 1];

    if (!simulationId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Simulation ID required" }));
      return;
    }

    // Get simulation from CrucibleService
    const { crucibleService } = getServices();
    const simulation = await crucibleService!.getSimulation(simulationId);

    if (!simulation) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Simulation not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        data: {
          id: simulation.id,
          winner: simulation.winner,
          rounds: simulation.rounds,
          casualties: simulation.casualties,
          tacticalAnalysis: simulation.tacticalAnalysis,
          isComplete: simulation.isComplete,
        },
      }),
    );
  } catch (error) {
    logger.error("Failed to get simulation:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: false,
        error: "Failed to get simulation",
        details: getErrorMessage(error),
      }),
    );
  }
};

/**
 * POST /combat/positioning
 * Analyze optimal positioning for characters in combat
 */
export const getPositioningHandler: RouteHandler = async (ctx) => {
  try {
    // Check authentication
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    // Parse and validate request body
    let body;
    try {
      body = await parseJsonBody(ctx.req);
    } catch (_error) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    const validatedData = PositionAnalysisSchema.parse(body);

    // Build positioning context for analysis
    const character = toCombatCharacter(validatedData.character, "party");
    const allies = (validatedData.allies || []).map((ally) => toCombatCharacter(ally, "party"));
    const enemies = (validatedData.enemies || []).map((enemy) =>
      toCombatCharacter(enemy, "enemies"),
    );

    const positioningContext = {
      character,
      currentPosition: character.position,
      battlefield: validatedData.battlefield,
      allies,
      enemies,
      movementSpeed: character.speed ?? 30,
      threatLevel: calculateThreatLevel(validatedData.enemies),
    };

    // Get positioning analysis from Crucible AI service
    const { crucibleService } = getServices();
    const positioningAnalysis = await crucibleService!.analyzePositioning(positioningContext);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        data: {
          currentPosition: character.position,
          recommendedPositions: positioningAnalysis.recommendedPositions || [],
          reasoning:
            positioningAnalysis.currentPositionAnalysis?.risks?.join(", ") ||
            "No specific positioning recommendations",
          tacticalAdvantages: positioningAnalysis.currentPositionAnalysis?.benefits || [],
          risks: positioningAnalysis.currentPositionAnalysis?.risks || [],
          movementOptions: positioningAnalysis.movementOptions || [],
        },
      }),
    );
  } catch (error) {
    logger.error("Positioning analysis failed:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: false,
        error: "Failed to analyze positioning",
        details: getErrorMessage(error),
      }),
    );
  }
};

// Crucible service will be integrated when AI service is available
