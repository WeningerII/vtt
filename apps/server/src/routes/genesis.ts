/**
 * Genesis Character Creation API Route Handlers
 */

import { z } from "zod";
import { logger } from "@vtt/logging";
import { generateCharacter } from "../genisis/service";
import { DatabaseManager } from "../database/connection";
import type { RouteHandler } from "../router/types";
import { getErrorMessage } from "../utils/errors";

// Lazy-load Prisma client to avoid initialization issues during module loading
let prisma: any | null = null;

function getPrisma() {
  if (!prisma) {
    prisma = DatabaseManager.getInstance();
  }
  return prisma;
}

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
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    // Parse and validate request body
    let body;
    try {
      const bodyData = await new Promise<string>((resolve, reject) => {
        let data = "";
        ctx.req.on("data", (chunk) => (data += chunk));
        ctx.req.on("end", () => resolve(data));
        ctx.req.on("error", reject);
      });
      body = JSON.parse(bodyData);
    } catch (_error) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    const { prompt, preferences } = validateCharacterConcept(body);
    const userId = user.id;

    // TODO: Fix GenesisService integration
    // const generation = await generateCharacter({ concept: prompt, ...preferences });
    const generation = { id: 'temp', currentStep: 'concept', steps: [], isComplete: false };

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
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    // Extract generationId from URL path
    const pathParts = ctx.url.pathname.split("/");
    const generationId = pathParts[pathParts.length - 1];

    // TODO: Fix GenesisService integration
    const generation: any = null; // genesisService.getGeneration(generationId);
    if (!generation) {
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
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    // Extract generationId from URL path
    const pathParts = ctx.url.pathname.split("/");
    const generationId = pathParts[pathParts.length - 2]; // Before /retry

    // Parse request body
    let body;
    try {
      const bodyData = await new Promise<string>((resolve, reject) => {
        let data = "";
        ctx.req.on("data", (chunk) => (data += chunk));
        ctx.req.on("end", () => resolve(data));
        ctx.req.on("error", reject);
      });
      body = JSON.parse(bodyData);
    } catch (_error) {
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
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    const userId = user.id;
    // TODO: Fix GenesisService integration
    const history: any[] = []; // await genesisService.getGenerationHistory(userId);

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
export const _handleGenesisWebSocket = (ws: any, message: Record<string, unknown>, _userId: string) => {
  switch (message.type) {
    case "GENESIS_SUBSCRIBE":
      {
        const { generationId } = message.payload as any;

        // Subscribe to generation updates
        ws.generationSubscription = generationId;

        // Send current status
        // TODO: Fix GenesisService integration
        const generation: any = null; // genesisService.getGeneration(generationId);
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
