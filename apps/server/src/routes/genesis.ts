/**
 * Genesis Character Creation API Route Handlers
 */

import { z } from "zod";
import { logger } from "@vtt/logging";
import type { PrismaClient } from "@prisma/client";
import type { WebSocket } from "ws";
import type { RouteHandler } from "../router/types";
import { getErrorMessage } from "../utils/errors";
import { parseJsonBody } from "../utils/json";
import { DatabaseManager } from "../database/connection";
import { GenesisService, type CharacterGeneration, type GenerationStep } from "../ai/character";

interface RequestUser {
  id: string;
}

const getRequestUser = (req: unknown): RequestUser | null => {
  if (!req || typeof req !== "object") {
    return null;
  }
  const maybeUser = (req as { user?: { id?: unknown } }).user;
  if (!maybeUser || typeof maybeUser.id !== "string") {
    return null;
  }
  return { id: maybeUser.id };
};

type GenesisSocketMessage = {
  type: "GENESIS_SUBSCRIBE" | "GENESIS_UNSUBSCRIBE";
  payload?: Record<string, unknown>;
};

type GenesisWebSocket = WebSocket & {
  generationSubscription?: string | null;
};

const prisma = DatabaseManager.getInstance() as PrismaClient;
const genesisService = new GenesisService(prisma);

const stepNames = [
  "concept",
  "race",
  "class",
  "background",
  "abilities",
  "equipment",
  "spells",
  "personality",
  "optimization",
] as const satisfies [GenerationStep["step"], ...GenerationStep["step"][]];

const serializeGeneration = (generation: CharacterGeneration) => ({
  id: generation.id,
  concept: generation.concept,
  currentStep: generation.currentStep,
  isComplete: generation.isComplete,
  steps: generation.steps,
  character: generation.character ?? null,
  error: generation.error ?? null,
  metadata: {
    ...generation.metadata,
    generatedAt: generation.metadata.generatedAt.toISOString(),
  },
  status: generation.isComplete ? "completed" : generation.error ? "error" : "processing",
});

// Validation helpers
const validateCharacterConcept = (body: unknown) => {
  const schema = z.object({
    prompt: z.string().min(10).max(1000),
    preferences: z
      .object({
        system: z.enum(["dnd5e", "pathfinder", "generic"]).optional(),
        powerLevel: z.enum(["low", "standard", "high", "epic"]).optional(),
        complexity: z.enum(["simple", "moderate", "complex"]).optional(),
        playstyle: z.enum(["combat", "roleplay", "exploration", "balanced"]).optional(),
      })
      .optional(),
  });
  return schema.parse(body);
};

const validateRetryStep = (body: unknown) => {
  const schema = z.object({
    stepName: z.enum(stepNames),
  });
  return schema.parse(body);
};

/**
 * POST /genesis/generate
 * Start character generation from concept
 */
export const generateCharacterHandler: RouteHandler = async (ctx) => {
  try {
    // Check authentication
    const user = getRequestUser(ctx.req);
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await parseJsonBody<unknown>(ctx.req);
    } catch {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    const conceptRequest = validateCharacterConcept(body);
    const userId = user.id;

    const generation = await genesisService.startGeneration(conceptRequest, userId);

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        data: serializeGeneration(generation),
      }),
    );
  } catch (error) {
    logger.error("Genesis generation failed:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: "Failed to start character generation",
        details: getErrorMessage(error),
      }),
    );
  }
};

/**
 * GET /genesis/:generationId
 * Get generation status and progress
 */
export const getGenerationStatusHandler: RouteHandler = async (ctx) => {
  try {
    // Check authentication
    const user = getRequestUser(ctx.req);
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    // Extract generationId from URL path
    const pathParts = ctx.url.pathname.split("/");
    const generationId = pathParts[pathParts.length - 1];

    const generation = genesisService.getGeneration(generationId);
    if (!generation) {
      logger.warn("Genesis generation not found", { generationId });
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(
        JSON.stringify({
          success: false,
          error: "Generation not found",
        }),
      );
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        data: serializeGeneration(generation),
      }),
    );
  } catch (error) {
    logger.error("Failed to get generation status:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: "Failed to get generation status",
        details: getErrorMessage(error),
      }),
    );
  }
};

/**
 * POST /genesis/:generationId/retry
 * Retry a specific generation step
 */
export const retryGenerationStepHandler: RouteHandler = async (ctx) => {
  try {
    // Check authentication
    const user = getRequestUser(ctx.req);
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    // Extract generationId from URL path
    const pathParts = ctx.url.pathname.split("/");
    const generationId = pathParts[pathParts.length - 2]; // Before /retry

    // Parse request body
    let body: unknown;
    try {
      body = await parseJsonBody<unknown>(ctx.req);
    } catch {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    const { stepName } = validateRetryStep(body);

    await genesisService.retryStep(generationId, stepName);
    const updatedGeneration = genesisService.getGeneration(generationId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        message: `Retrying step: ${stepName}`,
        generationId,
        data: updatedGeneration ? serializeGeneration(updatedGeneration) : null,
      }),
    );
  } catch (error) {
    logger.error("Failed to retry generation step:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: "Failed to retry generation step",
        details: getErrorMessage(error),
      }),
    );
  }
};

/**
 * GET /genesis/history
 * Get user's generation history
 */
export const getGenerationHistoryHandler: RouteHandler = async (ctx) => {
  try {
    // Check authentication
    const user = getRequestUser(ctx.req);
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    const userId = user.id;
    logger.debug("Fetching genesis generation history", { userId });
    const history = await genesisService.getGenerationHistory(userId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        data: history.map((generation) => serializeGeneration(generation)),
      }),
    );
  } catch (error) {
    logger.error("Failed to get generation history:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: "Failed to get generation history",
        details: getErrorMessage(error),
      }),
    );
  }
};

/**
 * WebSocket events for real-time generation updates
 */
export const _handleGenesisWebSocket = (
  ws: GenesisWebSocket,
  message: GenesisSocketMessage,
  _userId: string,
): void => {
  switch (message.type) {
    case "GENESIS_SUBSCRIBE":
      {
        const payload = message.payload ?? {};
        const generationId = typeof payload.generationId === "string" ? payload.generationId : null;

        if (!generationId) {
          break;
        }

        // Subscribe to generation updates
        ws.generationSubscription = generationId;

        // Send current status
        try {
          const generation = genesisService.getGeneration(generationId);
          if (!generation) {
            break;
          }

          ws.send(
            JSON.stringify({
              type: "GENESIS_UPDATE",
              payload: serializeGeneration(generation),
            }),
          );
        } catch (error) {
          logger.error("Failed to fetch genesis generation for websocket", error);
        }
      }
      break;

    case "GENESIS_UNSUBSCRIBE":
      ws.generationSubscription = null;
      break;
  }
};

// TODO: Fix genesis service integration - currently using function-based approach
// export { genesisService };
