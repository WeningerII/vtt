import { RouteHandler } from "../router/types";
import { parseJsonBody, sendJson } from "../utils/json";
import { createAssistantService, type AssistantQuery } from "../ai/assistant";
import { getErrorMessage } from "../utils/errors";

interface AssistantContextBody {
  context?: AssistantQuery["context"];
}

interface QueryRulesBody extends AssistantContextBody {
  question?: string;
}

interface ExplainSpellBody extends AssistantContextBody {
  spellName?: string;
}

interface ExplainRuleBody extends AssistantContextBody {
  ruleTopic?: string;
}

interface SuggestActionsBody extends AssistantContextBody {
  situation?: string;
}

interface GenerateRulingBody extends AssistantContextBody {
  scenario?: string;
}

export const queryRulesHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody<QueryRulesBody>(ctx.req);
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
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};

export const explainSpellHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody<ExplainSpellBody>(ctx.req);
  const assistantService = createAssistantService(ctx.prisma);

  if (!data.spellName) {
    return sendJson(ctx.res, { error: "spellName is required" }, 400);
  }

  try {
    const result = await assistantService.explainSpell(data.spellName, data.context);
    sendJson(ctx.res, result);
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};

export const explainRuleHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody<ExplainRuleBody>(ctx.req);
  const assistantService = createAssistantService(ctx.prisma);

  if (!data.ruleTopic) {
    return sendJson(ctx.res, { error: "ruleTopic is required" }, 400);
  }

  try {
    const result = await assistantService.explainRule(data.ruleTopic, data.context);
    sendJson(ctx.res, result);
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};

export const suggestActionsHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody<SuggestActionsBody>(ctx.req);
  const assistantService = createAssistantService(ctx.prisma);

  if (!data.situation) {
    return sendJson(ctx.res, { error: "situation is required" }, 400);
  }

  try {
    const result = await assistantService.suggestActions(data.situation, data.context);
    sendJson(ctx.res, result);
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};

export const generateRulingHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody<GenerateRulingBody>(ctx.req);
  const assistantService = createAssistantService(ctx.prisma);

  if (!data.scenario) {
    return sendJson(ctx.res, { error: "scenario is required" }, 400);
  }

  try {
    const result = await assistantService.generateRuling(data.scenario, data.context);
    sendJson(ctx.res, result);
  } catch (error) {
    sendJson(ctx.res, { error: getErrorMessage(error) }, 500);
  }
};
