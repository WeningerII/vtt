import { RouteHandler } from "../router/types";
import { sendJson } from "../utils/json";
import { DatabaseManager } from "../database/connection";

/**
 * @swagger
 * /livez:
 *   get:
 *     tags: [Health]
 *     summary: Liveness probe endpoint
 *     description: Returns basic server status for Kubernetes liveness checks
 *     responses:
 *       200:
 *         description: Server is alive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthStatus'
 */
export const livenessHandler: RouteHandler = async (ctx) => {
  sendJson(ctx.res, {
    ok: true,
    uptimeSec: Math.floor(process.uptime()),
  });
};

/**
 * @swagger
 * /readyz:
 *   get:
 *     tags: [Health]
 *     summary: Readiness probe endpoint
 *     description: Returns server readiness status including database connectivity
 *     responses:
 *       200:
 *         description: Server is ready to serve traffic
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthStatus'
 *       503:
 *         description: Server is not ready (database unavailable)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthStatus'
 */
export const readinessHandler: RouteHandler = async (ctx) => {
  const dbOk = await DatabaseManager.healthCheck();
  const ready = dbOk;
  const status = ready ? 200 : 503;
  sendJson(
    ctx.res,
    {
      ok: ready,
      db: dbOk ? "up" : "down",
    },
    status);
};
