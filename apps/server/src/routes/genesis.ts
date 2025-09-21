/**
 * Genesis Character Creation API Route Handlers
 */

import { z } from "zod";
import { logger } from "@vtt/logging";
import type { WebSocket } from "ws";
import type { RouteHandler } from "../router/types";
import { getErrorMessage } from "../utils/errors";
import { parseJsonBody } from "../utils/json";

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

interface GenesisGeneration {
  id: string;
  currentStep: string;
  isComplete: boolean;
  steps: unknown[];
  concept?: string;
  character: {
    id: string;
    name: string;
    race: string;
    class: string;
  } | null;
  error?: unknown;
  metadata: {
    generatedAt?: string;
    [key: string]: unknown;
  };
}

type GenesisSocketMessage = {
  type: "GENESIS_SUBSCRIBE" | "GENESIS_UNSUBSCRIBE";
  payload?: Record<string, unknown>;
};

type GenesisWebSocket = WebSocket & {
  generationSubscription?: string | null;
};

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
    stepName: z.enum([
      "concept",
      "race",
      "class",
      "background",
      "abilities",
      "equipment",
      "spells",
      "personality",
      "optimization",
    ]),
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

    // TODO: Fix GenesisService integration
    // const generation = await generateCharacter({ concept: prompt, ...preferences });
    const generation: GenesisGeneration = {
      id: "temp",
      currentStep: "concept",
      steps: [],
      isComplete: false,
      character: null,
      error: undefined,
      metadata: {
        generatedAt: new Date().toISOString(),
        prompt: conceptRequest.prompt,
        preferences: conceptRequest.preferences ?? null,
        requestedBy: userId,
      },
    };

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        data: {
          generationId: generation.id,
          status: "started",
          currentStep: generation.currentStep,
          steps: generation.steps,
        },
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

    // TODO: Fix GenesisService integration
    const generation: GenesisGeneration | null = null; // genesisService.getGeneration(generationId);
    if (!generation) {
      logger.warn({ generationId }, "Genesis generation not found");
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
        data: {
          id: generation.id,
          currentStep: generation.currentStep,
          isComplete: generation.isComplete,
          steps: generation.steps,
          character: generation.character,
          error: generation.error,
          metadata: generation.metadata,
        },
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

    // TODO: Fix GenesisService integration
    // await genesisService.retryStep(generationId, stepName);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        message: `Retrying step: ${stepName}`,
        generationId,
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
    logger.debug({ userId }, "Fetching genesis generation history");
    // TODO: Fix GenesisService integration
    const history: GenesisGeneration[] = []; // await genesisService.getGenerationHistory(userId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        data: history.map((gen) => ({
          id: gen.id,
          concept: gen.concept,
          isComplete: gen.isComplete,
          currentStep: gen.currentStep,
          generatedAt: gen.metadata.generatedAt,
          character: gen.character
            ? {
                id: gen.character.id,
                name: gen.character.name,
                race: gen.character.race,
                class: gen.character.class,
              }
            : null,
          requestedBy: gen.metadata.requestedBy ?? null,
        })),
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
        // TODO: Fix GenesisService integration
        const generation: GenesisGeneration | null = null; // genesisService.getGeneration(generationId);
        if (generation) {
          ws.send(
            JSON.stringify({
              type: "GENESIS_UPDATE",
              payload: {
                generationId,
                currentStep: generation.currentStep,
                steps: generation.steps,
                isComplete: generation.isComplete,
                error: generation.error,
              },
            }),
          );
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
