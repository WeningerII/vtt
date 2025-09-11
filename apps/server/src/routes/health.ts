import { RouteHandler } from "../router/types";
import { sendJson } from "../utils/json";

export const healthHandler: RouteHandler = async (ctx) => {
  await ctx.prisma.$queryRaw`SELECT 1`;
  const port = Number(process.env.PORT ?? 8080);
  sendJson(ctx.res, { ok: true, ws: `ws://localhost:${port}/ws` });
};
