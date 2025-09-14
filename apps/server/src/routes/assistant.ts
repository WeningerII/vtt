import { RouteHandler } from "../router/types";
import { parseJsonBody, sendJson } from "../utils/json";
import { createAssistantService } from "../ai/assistant";

export const queryRulesHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const assistantService = createAssistantService(ctx.prisma);

  if (!data.question) {
    return sendJson(ctx.res, { error: "question is required" }, 400);
  }

  try {
    const result = await assistantService.queryRules({
      question: data.question,
      context: data.context,
    });

    sendJson(ctx.res, result);
  } catch (error: unknown) {
    sendJson(ctx.res, { error: error.message }, 500);
  }
};

export const explainSpellHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const assistantService = createAssistantService(ctx.prisma);

  if (!data.spellName) {
    return sendJson(ctx.res, { error: "spellName is required" }, 400);
  }

  try {
    const result = await assistantService.explainSpell(data.spellName, data.context);
    sendJson(ctx.res, result);
  } catch (error: unknown) {
    sendJson(ctx.res, { error: error.message }, 500);
  }
};

export const explainRuleHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const assistantService = createAssistantService(ctx.prisma);

  if (!data.ruleTopic) {
    return sendJson(ctx.res, { error: "ruleTopic is required" }, 400);
  }

  try {
    const result = await assistantService.explainRule(data.ruleTopic, data.context);
    sendJson(ctx.res, result);
  } catch (error: unknown) {
    sendJson(ctx.res, { error: error.message }, 500);
  }
};

export const suggestActionsHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const assistantService = createAssistantService(ctx.prisma);

  if (!data.situation) {
    return sendJson(ctx.res, { error: "situation is required" }, 400);
  }

  try {
    const result = await assistantService.suggestActions(data.situation, data.context);
    sendJson(ctx.res, result);
  } catch (error: unknown) {
    sendJson(ctx.res, { error: error.message }, 500);
  }
};

export const generateRulingHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const assistantService = createAssistantService(ctx.prisma);

  if (!data.scenario) {
    return sendJson(ctx.res, { error: "scenario is required" }, 400);
  }

  try {
    const result = await assistantService.generateRuling(data.scenario, data.context);
    sendJson(ctx.res, result);
  } catch (error: unknown) {
    sendJson(ctx.res, { error: error.message }, 500);
  }
};
