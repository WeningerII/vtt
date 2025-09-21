import { RouteHandler } from "../router/types";
import { getErrorMessage } from "../utils/errors";
import { parseJsonBody, sendJson } from "../utils/json";
import { createContentGenerationService } from "../ai/content";

interface BaseContentBody {
  setting?: string;
  theme?: string;
  playerLevel?: number;
  additionalContext?: string;
  difficulty?: string;
  partySize?: number;
  environment?: string;
}

interface CampaignContentBody {
  campaignId?: string;
  contentType?: string;
}

export const generateNPCHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody<BaseContentBody>(ctx.req);
  const contentService = createContentGenerationService(ctx.prisma);

  try {
    const setting = typeof data.setting === "string" ? data.setting : "fantasy";
    const theme = typeof data.theme === "string" ? data.theme : "neutral";
    const playerLevel = typeof data.playerLevel === "number" ? data.playerLevel : 5;
    const additionalContext =
      typeof data.additionalContext === "string" ? data.additionalContext : undefined;

    const result = await contentService.generateNPC({
      setting,
      theme,
      playerLevel,
      additionalContext,
    });

    sendJson(ctx.res, result);
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};

export const generateLocationHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody<BaseContentBody>(ctx.req);
  const contentService = createContentGenerationService(ctx.prisma);

  try {
    const setting = typeof data.setting === "string" ? data.setting : "fantasy";
    const theme = typeof data.theme === "string" ? data.theme : "neutral";
    const additionalContext =
      typeof data.additionalContext === "string" ? data.additionalContext : undefined;

    const result = await contentService.generateLocation({
      setting,
      theme,
      additionalContext,
    });

    sendJson(ctx.res, result);
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};

export const generateQuestHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody<BaseContentBody>(ctx.req);
  const contentService = createContentGenerationService(ctx.prisma);

  try {
    const setting = typeof data.setting === "string" ? data.setting : "fantasy";
    const theme = typeof data.theme === "string" ? data.theme : "adventure";
    const difficulty = typeof data.difficulty === "string" ? data.difficulty : "medium";
    const playerLevel = typeof data.playerLevel === "number" ? data.playerLevel : 5;
    const additionalContext =
      typeof data.additionalContext === "string" ? data.additionalContext : undefined;

    const result = await contentService.generateQuest({
      setting,
      theme,
      difficulty,
      playerLevel,
      additionalContext,
    });

    sendJson(ctx.res, result);
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};

export const generateItemHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody<BaseContentBody>(ctx.req);
  const contentService = createContentGenerationService(ctx.prisma);

  try {
    const setting = typeof data.setting === "string" ? data.setting : "fantasy";
    const theme = typeof data.theme === "string" ? data.theme : "neutral";
    const playerLevel = typeof data.playerLevel === "number" ? data.playerLevel : 5;
    const additionalContext =
      typeof data.additionalContext === "string" ? data.additionalContext : undefined;

    const result = await contentService.generateItem({
      setting,
      theme,
      playerLevel,
      additionalContext,
    });

    sendJson(ctx.res, result);
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};

export const generateEncounterHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody<BaseContentBody>(ctx.req);
  const contentService = createContentGenerationService(ctx.prisma);

  try {
    const playerLevel = typeof data.playerLevel === "number" ? data.playerLevel : 5;
    const partySize = typeof data.partySize === "number" ? data.partySize : 4;
    const setting = typeof data.setting === "string" ? data.setting : "fantasy";
    const difficulty = typeof data.difficulty === "string" ? data.difficulty : "medium";
    const theme = typeof data.theme === "string" ? data.theme : undefined;
    const environment = typeof data.environment === "string" ? data.environment : undefined;

    const result = await contentService.generateEncounter({
      playerLevel,
      partySize,
      setting,
      difficulty,
      theme,
      environment,
    });

    sendJson(ctx.res, result);
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};

export const generateCampaignContentHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody<CampaignContentBody>(ctx.req);
  const campaignId = typeof data.campaignId === "string" ? data.campaignId : undefined;
  const contentType = typeof data.contentType === "string" ? data.contentType : undefined;

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
