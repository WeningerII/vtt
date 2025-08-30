import { RouteHandler } from "../router/types";
import { parseJsonBody, sendJson } from "../utils/json";
import { generateCharacter } from "../genisis/service";

export const generateCharacterHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const result = await generateCharacter({
    concept: data.concept,
    name: data.name,
    model: data.model,
  });
  sendJson(ctx.res, result);
};
