import { Middleware } from "../router/types";
import { logger } from "@vtt/logging";

export const loggingMiddleware: Middleware = async (ctx, next) => {
  const start = Date.now();
  const method = ctx.req.method;
  const path = ctx.url.pathname;
  const ip = ctx.req.socket.remoteAddress;
  const rid = ctx.requestId;

  logger.info(`[${new Date().toISOString()}] rid=${rid} ${method} ${path} - ${ip}`);

  try {
    await next();
    const duration = Date.now() - start;
    logger.info(
      `[${new Date().toISOString()}] rid=${rid} ${method} ${path} - ${ctx.res.statusCode} (${duration}ms)`,
    );
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(
      `[${new Date().toISOString()}] rid=${rid} ${method} ${path} - ERROR (${duration}ms)`,
      error as Error,
    );
    throw error;
  }
};
