import { Middleware } from "../router/types";
import { logger } from "@vtt/logging";

export const loggingMiddleware: Middleware = async (ctx, next) => {
  const start = Date.now();
  const method = ctx.req.method;
  const path = ctx.url.pathname;
  const ip = ctx.req.socket.remoteAddress;
  const rid = ctx.requestId;

  logger.info(`[${new Date().toISOString()}] rid=${rid} ${method} ${path} - ${ip}`);

  await next();
  
  const duration = Date.now() - start;
  const statusCode = ctx.res.statusCode || 'unknown';
  logger.info(
    `[${new Date().toISOString()}] rid=${rid} ${method} ${path} - ${statusCode} (${duration}ms)`,
  );
};
