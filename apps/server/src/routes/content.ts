import { RouteHandler } from "../router/types";
import { getErrorMessage } from "../utils/errors";
import { parseJsonBody, sendJson } from "../utils/json";
import { createContentGenerationService } from "../ai/content";

export const generateNPCHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const contentService = createContentGenerationService(ctx.prisma);

  try {
    const result = await contentService.generateNPC({
      setting: data.setting || "fantasy",
      theme: data.theme || "neutral",
      playerLevel: data.playerLevel || 5,
      additionalContext: data.additionalContext,
    });

    sendJson(ctx.res, result);
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};

export const generateLocationHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const contentService = createContentGenerationService(ctx.prisma);

  try {
    const result = await contentService.generateLocation({
      setting: data.setting || "fantasy",
      theme: data.theme || "neutral",
      additionalContext: data.additionalContext,
    });

    sendJson(ctx.res, result);
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};

export const generateQuestHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const contentService = createContentGenerationService(ctx.prisma);

  try {
    const result = await contentService.generateQuest({
      setting: data.setting || "fantasy",
      theme: data.theme || "adventure",
      difficulty: data.difficulty || "medium",
      playerLevel: data.playerLevel || 5,
      additionalContext: data.additionalContext,
    });

    sendJson(ctx.res, result);
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};

export const generateItemHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const contentService = createContentGenerationService(ctx.prisma);

  try {
    const result = await contentService.generateItem({
      setting: data.setting || "fantasy",
      theme: data.theme || "neutral",
      playerLevel: data.playerLevel || 5,
      additionalContext: data.additionalContext,
    });

    sendJson(ctx.res, result);
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};

export const generateEncounterHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const contentService = createContentGenerationService(ctx.prisma);

  try {
    const result = await contentService.generateEncounter({
      playerLevel: data.playerLevel || 5,
      partySize: data.partySize || 4,
      setting: data.setting || "fantasy",
      difficulty: data.difficulty || "medium",
      theme: data.theme,
      environment: data.environment,
    });

    sendJson(ctx.res, result);
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};

export const generateCampaignContentHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const { campaignId, contentType } = data;

  if (!campaignId || !contentType) {
    return sendJson(ctx.res, { error: "campaignId and contentType are required" }, 400);
  }

  const contentService = createContentGenerationService(ctx.prisma);

  try {
    const result = await contentService.generateCampaignContent(campaignId, contentType);
    sendJson(ctx.res, result);
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};
