import { PrismaClient } from "@prisma/client";
import { logger } from "@vtt/logging";
import { aiProviderRegistry } from "@vtt/core";
import { buildSystemPrompt, buildUserPrompt, safeJsonExtract, applyNameFallback } from "./utils";
import type { CharacterSheet, GenerateInput } from "./types";

/**
 * Genesis Character Generation Service
 * Generates D&D 5E character sheets using AI providers
 */

const prisma = new PrismaClient();

export async function generateCharacter(input: GenerateInput) {
  if (!input?.concept || typeof input.concept !== "string") {
    throw new Error("Missing 'concept' in request body");
  }

  const system = buildSystemPrompt();
  const user = buildUserPrompt(input.concept, input.name);

  const startTime = performance.now();

  try {
    // Use unified AI provider registry for provider-agnostic text generation
    const response = await aiProviderRegistry.generateText(user, {
      systemPrompt: system,
      ...(input.model && { model: input.model }),
      maxTokens: 2000,
      temperature: 0.8,
    });

    const sheet = safeJsonExtract<CharacterSheet>(response.text);
    const finalSheet = applyNameFallback(sheet, input.name);
    const latencyMs = performance.now() - startTime;

    // Get the best provider info for logging
    const bestProvider = aiProviderRegistry.getBestProvider("text_generation");
    const providerName = bestProvider?.name || "unknown";

    const db = prisma as any; // TODO: Define proper Character type after prisma generate
    const character = await db.character.create({
      data: {
        name: finalSheet.name ?? "Unnamed",
        sheet: finalSheet as any, // TODO: Use proper Prisma JsonValue type
        prompt: user,
        provider: providerName,
        model: response.model,
        cost: (response.usage.totalTokens / 1000) * 0.002, // Rough cost estimate
        latencyMs: Math.round(latencyMs),
      },
    });

    return {
      character,
      provider: providerName,
      model: response.model,
      usage: response.usage,
    };
  } catch (error) {
    // Log error and re-throw with context
    logger.error("Character generation failed:", error);
    throw new Error(
      `Character generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
