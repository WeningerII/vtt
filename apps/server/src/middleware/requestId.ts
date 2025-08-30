import { Middleware } from "../router/types";
import { randomUUID } from "crypto";

function generateId(): string {
  try {
    return randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

export const requestIdMiddleware: Middleware = async (ctx, _next) => {
  const header = ctx.req.headers["x-request-id"];
  const requestId =
    typeof header === "string" && header.trim().length > 0 ? header.trim() : generateId();
  ctx.requestId = requestId;
  ctx.res.setHeader("X-Request-ID", requestId);
  await _next();
};
