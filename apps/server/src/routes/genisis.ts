import { RouteHandler } from "../router/types";
import { parseJsonBody, sendJson } from "../utils/json";
import { generateCharacter } from "../genisis/service";

interface GenisisGenerateBody {
  concept?: string;
  name?: string;
  model?: string;
}

export const generateCharacterHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody<GenisisGenerateBody>(ctx.req);

  if (!data.concept || !data.name || !data.model) {
    sendJson(ctx.res, { error: "concept, name, and model are required" }, 400);
    return;
  }

  const result = await generateCharacter({
    concept: data.concept,
    name: data.name,
    model: data.model,
  });
  sendJson(ctx.res, result);
};
