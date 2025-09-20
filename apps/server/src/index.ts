// Load environment variables
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { logger } from "@vtt/logging";
import { createServer } from "http";
import { URL } from "url";
import { WebSocketServer } from "ws";
import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth";
import { sessionsRouter } from "./routes/sessions";
import { tokensRouter } from "./routes/tokens";
import { VTTWebSocketServer } from "./websocket/websocket-server";
import { VTTSocketManager } from "./websocket/vttSocketManager";
import { loggingMiddleware } from "./middleware/logging";
import { errorMiddleware } from "./middleware/error";
import { requestIdMiddleware } from "./middleware/requestId";
import { securityHeadersMiddleware } from "./middleware/security";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { corsMiddleware } from "./middleware/cors";
import { csrfMiddleware, csrfTokenMiddleware } from "./middleware/csrf";
import {
  requireAdmin,
  requirePermission,
  optionalAuth,
  getAuthenticatedUserId,
} from "./middleware/auth";
import { getCorsConfig, isOriginAllowed } from "./config/cors";
import {
  metricsMiddleware,
  addDatabaseHealthCheck,
  addAIServiceHealthCheck,
} from "./middleware/metrics";
import { validateExpressRequest, GameSchemas, CommonSchemas } from "./middleware/validation";
import { z } from "zod";
import session from "express-session";
import { listProvidersHandler } from "./routes/ai";
import { getUsersHandler, createUserHandler } from "./routes/users";
import {
  generateCharacterHandler,
  getGenerationStatusHandler,
  retryGenerationStepHandler,
  getGenerationHistoryHandler,
  _handleGenesisWebSocket as handleGenesisWebSocket,
} from "./routes/genesis";
import {
  getTacticalDecisionHandler,
  simulateCombatHandler,
  analyzeCombatHandler,
  getActiveSimulationsHandler,
  getSimulationHandler,
  getPositioningHandler,
  _handleCombatWebSocket as handleCombatWebSocket,
} from "./routes/combat";
import { healthHandler } from "./routes/health";
import { livenessHandler, readinessHandler } from "./routes/healthz";
import { swaggerDocsHandler, swaggerJsonHandler } from "./routes/docs";
import { loginPageHandler } from "./routes/login";
import {
  createGameHandler,
  getGameHandler,
  joinGameHandler,
  leaveGameHandler,
  listGamesHandler,
  createTokenHandler,
  moveTokenHandler,
  rollDiceHandler,
} from "./routes/games";
import {
  createCharacterHandler,
  getCharacterHandler,
  getUserCharactersHandler,
  updateCharacterHandler,
  deleteCharacterHandler,
  getCharacterTemplatesHandler,
  levelUpCharacterHandler,
  characterRestHandler,
} from "./routes/characters";
import {
  createCampaignHandler,
  getCampaignHandler,
  getUserCampaignsHandler,
  updateCampaignHandler,
  deleteCampaignHandler,
  addPlayerHandler,
  removePlayerHandler,
  addCharacterToCampaignHandler,
  removeCharacterFromCampaignHandler,
  archiveCampaignHandler,
  getCampaignStatsHandler,
  getCampaignScenesHandler,
  createCampaignSceneHandler,
  setActiveCampaignSceneHandler,
  startSessionHandler,
  endSessionHandler,
  getActiveSessionHandler,
  getCampaignPlayersHandler,
  updatePlayerHandler,
  getCampaignSettingsHandler,
  updateCampaignSettingsHandler,
} from "./routes/campaigns";
import {
  uploadAssetHandler,
  getAssetHandler,
  downloadAssetHandler,
  searchAssetsHandler,
  updateAssetHandler,
  deleteAssetHandler,
  createTokenHandler as createAssetTokenHandler,
  createMapHandler,
  getAssetStatsHandler,
  getUserLibrariesHandler,
  createLibraryHandler,
} from "./routes/assets";
import {
  generateNPCHandler,
  generateLocationHandler,
  generateQuestHandler,
  generateItemHandler,
  generateEncounterHandler,
  generateCampaignContentHandler,
} from "./routes/content";
import {
  queryRulesHandler,
  explainSpellHandler,
  explainRuleHandler,
  suggestActionsHandler,
  generateRulingHandler,
} from "./routes/assistant";
import {
  createSceneHandler,
  getSceneHandler,
  updateSceneHandler,
  getScenesHandler,
  convertCoordinatesHandler,
  calculateDistanceHandler,
  getMovementPathHandler,
  addLightSourceHandler,
  removeLightSourceHandler,
  lineOfSightHandler,
  addFogAreaHandler,
  revealFogAreaHandler,
  createMeasurementHandler,
  getMeasurementsHandler,
  initializeCombatHandler,
  addCombatantHandler,
  nextTurnHandler,
  getCombatGridHandler,
  addGridEffectHandler,
  addTokenHandler,
  moveTokenHandler as moveSceneTokenHandler,
  updateTokenHandler,
  removeTokenHandler,
  uploadMapHandler,
  updateSceneSettingsHandler,
  getMapsHandler,
} from "./routes/maps";
import {
  seedSRDMonstersHandler,
  listMonstersHandler,
  getMonsterHandler,
  createMonsterHandler,
  updateMonsterHandler,
  deleteMonsterHandler,
  getMonsterStatsHandler,
} from "./routes/monsters";
import {
  healthCheckHandler,
  livenessProbeHandler,
  readinessProbeHandler,
  metricsHandler,
  prometheusMetricsHandler,
} from "./routes/metrics";
// UnifiedWebSocketManager removed - using VTTWebSocketServer directly
import { DatabaseManager } from "./database/connection";
import { initializeAuth } from "./auth";
import { Router } from "./router/router";
import type { Context } from "./router/types";
import { AuthConfig, getAuthManager } from "./auth/auth-manager";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as DiscordStrategy } from "passport-discord";

// Use DatabaseManager singleton for consistent database connection
const prisma = DatabaseManager.getInstance();

// Initialize authentication
const authConfig: AuthConfig = {
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  jwtExpiration: "1h",
  refreshTokenExpiration: "7d",
  bcryptRounds: 12,
};
const authManager = getAuthManager();

// Initialize Passport OAuth strategies
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "dummy-google-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy-google-client-secret",
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL || "http://localhost:8080/api/v1/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // For now, create a simple user object - you can enhance this later
        const user = {
          id: profile.id,
          email: profile.emails?.[0]?.value,
          displayName: profile.displayName,
          provider: "google",
        };
        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    },
  ),
);

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID || "123456789012345678",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "dummy-discord-client-secret",
      callbackURL:
        process.env.DISCORD_CALLBACK_URL || "http://localhost:8080/api/v1/auth/discord/callback",
      scope: ["identify", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = {
          id: profile.id,
          email: profile.email,
          displayName: profile.global_name || profile.username,
          provider: "discord",
        };
        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    },
  ),
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser((id: string, done) => {
  done(null, { id });
});

const PORT = Number(process.env.PORT ?? 8080);

// Create Express app for easier middleware handling
const app = express();

// Lightweight size guard for uploads (rejects early before hitting body parsers)
function enforceContentLength(maxBytes: number) {
  return (req: any, res: any, next: any) => {
    const cl = req.headers["content-length"];
    if (cl && Number(cl) > maxBytes) {
      return res.status(413).json({
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "Payload too large",
          limitBytes: maxBytes,
        },
      });
    }
    next();
  };
}

// Add CORS middleware BEFORE other middleware (Express variant using shared config)
app.use((req, res, next) => {
  const config = getCorsConfig();
  const origin = req.headers.origin as string | undefined;

  let allow = false;
  if (config.origin === true) {
    allow = true;
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else if (isOriginAllowed(origin, config)) {
    allow = true;
    res.setHeader("Access-Control-Allow-Origin", origin!);
  }

  if (allow) {
    res.setHeader("Access-Control-Allow-Methods", config.methods.join(","));
    res.setHeader("Access-Control-Allow-Headers", config.allowedHeaders.join(","));
    res.setHeader("Access-Control-Expose-Headers", config.exposedHeaders.join(","));
    res.setHeader("Access-Control-Max-Age", String(config.maxAge));
    if (config.credentials) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Add our new auth and session routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/sessions", sessionsRouter);
app.use("/api/v1/tokens", tokensRouter);

// Request validation for key endpoints (runs before custom Router bridge)
app.post("/api/v1/characters", validateExpressRequest({ body: GameSchemas.characterCreate }));

app.post("/api/v1/campaigns", validateExpressRequest({ body: GameSchemas.campaignCreate }));

app.get("/api/v1/monsters", validateExpressRequest({ query: GameSchemas.monsterQuery }));

app.post(
  "/api/v1/combat/tactical-decision",
  validateExpressRequest({ body: GameSchemas.tacticalDecision }),
);

// Additional lightweight validations
app.get("/api/v1/characters", validateExpressRequest({ query: CommonSchemas.pagination }));

app.get("/api/v1/campaigns", validateExpressRequest({ query: CommonSchemas.pagination }));

// Param validation for monster resource by id
const idParamSchema = z.object({ id: CommonSchemas.uuid });
app.get("/api/v1/monsters/:id", validateExpressRequest({ params: idParamSchema }));
app.put("/api/v1/monsters/:id", validateExpressRequest({ params: idParamSchema }));
app.delete("/api/v1/monsters/:id", validateExpressRequest({ params: idParamSchema }));

// File upload endpoints must be multipart/form-data
const multipartHeaderSchema = z
  .object({
    "content-type": z
      .string()
      .regex(/^multipart\/form-data/i, "Content-Type must be multipart/form-data"),
  })
  .passthrough();
app.post(
  "/api/v1/assets/upload",
  enforceContentLength(50 * 1024 * 1024), // 50MB
  validateExpressRequest({ headers: multipartHeaderSchema }),
);
app.post(
  "/api/v1/maps/upload",
  enforceContentLength(50 * 1024 * 1024), // 50MB
  validateExpressRequest({ headers: multipartHeaderSchema }),
);

// Assets: validate search, library creation, and updates
app.get(
  "/api/v1/assets",
  validateExpressRequest({
    query: z
      .object({
        name: z.string().min(1).max(255).optional(),
        type: z.enum(["image", "audio", "map", "token", "texture", "model", "document"]).optional(),
        isPublic: z
          .preprocess((v) => (typeof v === "string" ? v.toLowerCase() === "true" : v), z.boolean())
          .optional(),
        userId: CommonSchemas.uuid.optional(),
        campaignId: CommonSchemas.uuid.optional(),
        tags: z
          .preprocess((v) => {
            if (v === undefined) {
              return undefined;
            }
            if (Array.isArray(v)) {
              return v;
            }
            if (typeof v === "string") {
              return v
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            }
            return v;
          }, z.array(CommonSchemas.name))
          .optional(),
      })
      .merge(CommonSchemas.pagination),
  }),
);

app.get("/api/v1/assets/libraries", validateExpressRequest({ query: CommonSchemas.pagination }));

app.post(
  "/api/v1/assets/libraries",
  validateExpressRequest({
    body: z.object({
      name: CommonSchemas.name,
      description: CommonSchemas.description.optional(),
      isPublic: z.coerce.boolean().optional(),
    }),
  }),
);

app.put(
  "/api/v1/assets/*",
  validateExpressRequest({
    body: z.object({
      name: CommonSchemas.name.optional(),
      description: CommonSchemas.description.optional(),
      isPublic: z.coerce.boolean().optional(),
      tags: z
        .preprocess(
          (v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]),
          z.array(CommonSchemas.name),
        )
        .optional(),
      metadata: z.record(z.any()).optional(),
    }),
  }),
);

// Assets: token and map creation validations (pre-router)
const assetIdParamSchema = z.object({ assetId: z.string().min(1) });

const createAssetTokenBodySchema = z.object({
  gridSize: z.coerce.number().int().min(1).max(10).optional(),
  isPC: z.coerce.boolean().optional(),
  category: z
    .enum([
      "humanoid",
      "beast",
      "undead",
      "construct",
      "elemental",
      "fey",
      "fiend",
      "celestial",
      "dragon",
      "giant",
      "monstrosity",
      "ooze",
      "plant",
      "aberration",
      "other",
    ])
    .optional(),
  stats: z
    .object({
      ac: z.coerce.number().int().min(0).max(50).optional(),
      hp: z.coerce.number().int().min(0).max(10000).optional(),
      speed: z.coerce.number().int().min(0).max(500).optional(),
      cr: z.string().max(10).optional(),
    })
    .optional(),
});

const createAssetMapBodySchema = z.object({
  gridType: z.enum(["square", "hex", "none"]).optional(),
  gridSize: z.coerce.number().int().min(1).max(1000).optional(),
  gridOffsetX: z.coerce.number().int().min(-10000).max(10000).optional(),
  gridOffsetY: z.coerce.number().int().min(-10000).max(10000).optional(),
  scenes: z.any().optional(),
});

app.post(
  "/api/v1/assets/:assetId/create-token",
  validateExpressRequest({ params: assetIdParamSchema, body: createAssetTokenBodySchema }),
);
app.post(
  "/api/v1/assets/:assetId/create-map",
  validateExpressRequest({ params: assetIdParamSchema, body: createAssetMapBodySchema }),
);

// Bridge: Delegate requests to our custom Router. If not handled, continue with Express.
app.use(async (req, res, next) => {
  try {
    const url = new URL(
      req.originalUrl || req.url || "/",
      `http://${req.headers.host || "localhost"}`,
    );
    const ctx: Context = {
      req: req as any,
      res: res as any,
      prisma,
      url,
      requestId:
        (req.headers["x-request-id"] as string) ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };

    const handled = await router.handle(ctx);
    if (!handled) {
      return next();
    }
  } catch (error) {
    logger.error("[server] Router bridge error:", error as Error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// JSON 404 catch-all handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || "dev-session-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
};

app.use(session(sessionConfig) as any);
app.use(passport.initialize() as any);
app.use(passport.session() as any);

// Router setup
const router = new Router();

// Middleware
// Order matters: header-setting middlewares must run before route handlers
router.use(requestIdMiddleware);
router.use(corsMiddleware); // CORS must come early for preflight requests
router.use(securityHeadersMiddleware); // Security headers before response
router.use(csrfMiddleware); // CSRF protection after CORS
router.use(csrfTokenMiddleware); // Add CSRF token to response headers
router.use(rateLimitMiddleware);
router.use(metricsMiddleware);
// Populate ctx.req.user when a valid token is present so route handlers can access it
router.use(optionalAuth);
router.use(loggingMiddleware);
// Session and passport middleware
router.use(async (ctx, next) => {
  // Add session middleware to context
  const sessionMiddleware = session(sessionConfig);
  await new Promise<void>((resolve) => {
    sessionMiddleware(ctx.req as any, ctx.res as any, () => {
      // Initialize passport
      passport.initialize()(ctx.req as any, ctx.res as any, () => {
        passport.session()(ctx.req as any, ctx.res as any, () => {
          resolve();
        });
      });
    });
  });
  return next();
});

router.use(loggingMiddleware);

// Routes
// Root route - serve a welcome page
router.get("/", (ctx) => {
  ctx.res.writeHead(200, { "Content-Type": "text/html" });
  ctx.res.end(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>VTT Server</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .endpoints { display: grid; gap: 10px; }
        .endpoint { background: #f5f5f5; padding: 10px; border-radius: 5px; }
        .method { font-weight: bold; color: #007acc; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎲 VTT Server</h1>
        <p>Virtual Tabletop Server is running successfully!</p>
        <p><strong>Status:</strong> Healthy | <strong>Port:</strong> ${PORT}</p>
      </div>
      
      <h2>Available Endpoints</h2>
      <div class="endpoints">
        <div class="endpoint">
          <span class="method">GET</span> <code>/health</code> - Health check
        </div>
        <div class="endpoint">
          <span class="method">GET</span> <code>/api/v1/health</code> - Detailed health status
        </div>
        <div class="endpoint">
          <span class="method">GET</span> <code>/login</code> - Login page
        </div>
        <div class="endpoint">
          <span class="method">GET</span> <code>/docs</code> - API documentation
        </div>
        <div class="endpoint">
          <span class="method">GET</span> <code>/api/v1/games</code> - Game management
        </div>
        <div class="endpoint">
          <span class="method">GET</span> <code>/api/v1/characters</code> - Character management
        </div>
        <div class="endpoint">
          <span class="method">GET</span> <code>/api/v1/campaigns</code> - Campaign management
        </div>
      </div>
    </body>
    </html>
  `);
});

router.get("/api/v1/ai/providers", listProvidersHandler);

// Genesis AI Routes
router.post("/api/v1/genesis/generate", generateCharacterHandler);
router.get("/api/v1/genesis/status/:jobId", getGenerationStatusHandler);
router.post("/api/v1/genesis/retry/:jobId/:step", retryGenerationStepHandler);
router.get("/api/v1/genesis/history", getGenerationHistoryHandler);

// Combat AI Routes
router.post("/api/v1/combat/tactical-decision", getTacticalDecisionHandler);
router.post("/api/v1/combat/simulate", simulateCombatHandler);
router.get("/api/v1/combat/simulation/:simulationId", getSimulationHandler);
router.post("/api/v1/combat/positioning", getPositioningHandler);
router.post("/api/v1/combat/analyze", analyzeCombatHandler);
router.get("/api/v1/combat/simulations", getActiveSimulationsHandler);

// Health check and metrics endpoints
router.get("/api/v1/health", healthCheckHandler);
router.get("/api/v1/health/live", livenessProbeHandler);
router.get("/api/v1/health/ready", readinessProbeHandler);
router.get("/api/v1/metrics", metricsHandler);
router.get("/api/v1/metrics/prometheus", prometheusMetricsHandler);

// Legacy health check endpoints
router.get("/health", healthHandler); // legacy: readiness
router.get("/livez", livenessHandler);
router.get("/readyz", readinessHandler);
router.get("/api/v1/users", getUsersHandler);
router.post("/api/v1/users", createUserHandler);
// OAuth routes are registered directly above
router.get("/docs", swaggerDocsHandler);
router.get("/api-docs.json", swaggerJsonHandler);
router.get("/login", loginPageHandler);

// Game management routes
router.post("/api/v1/games", createGameHandler);
router.get("/api/v1/games", listGamesHandler);
router.get("/api/v1/games/*", getGameHandler);
router.post("/api/v1/games/*/join", joinGameHandler);
router.post("/api/v1/games/*/leave", leaveGameHandler);
router.post("/api/v1/games/*/tokens", createTokenHandler);
router.post("/api/v1/games/*/tokens/*/move", moveTokenHandler);
router.post("/api/v1/games/*/dice", rollDiceHandler);

// Character management routes
router.post("/api/v1/characters", createCharacterHandler);
router.get("/api/v1/characters", getUserCharactersHandler);
router.get("/api/v1/characters/*", getCharacterHandler);
router.put("/api/v1/characters/*", updateCharacterHandler);
router.delete("/api/v1/characters/*", deleteCharacterHandler);
router.get("/api/v1/character-templates", getCharacterTemplatesHandler);
router.post("/api/v1/characters/*/level-up", levelUpCharacterHandler);
router.post("/api/v1/characters/*/rest", characterRestHandler);

// Campaign management routes
router.post("/api/v1/campaigns", createCampaignHandler);
router.get("/api/v1/campaigns", getUserCampaignsHandler);
router.get("/api/v1/campaigns/*", getCampaignHandler);
router.put("/api/v1/campaigns/*", updateCampaignHandler);
router.delete("/api/v1/campaigns/*", deleteCampaignHandler);
router.get("/api/v1/campaigns/*/players", getCampaignPlayersHandler);
router.post("/api/v1/campaigns/*/players", addPlayerHandler);
router.put("/api/v1/campaigns/*/players/*", updatePlayerHandler);
router.delete("/api/v1/campaigns/*/players/*", removePlayerHandler);
router.get("/api/v1/campaigns/*/settings", getCampaignSettingsHandler);
router.put("/api/v1/campaigns/*/settings", updateCampaignSettingsHandler);
router.post("/api/v1/campaigns/*/characters", addCharacterToCampaignHandler);
router.delete("/api/v1/campaigns/*/characters/*", removeCharacterFromCampaignHandler);
router.post("/api/v1/campaigns/*/archive", archiveCampaignHandler);
router.get("/api/v1/campaigns/*/stats", getCampaignStatsHandler);
router.get("/api/v1/campaigns/*/scenes", getCampaignScenesHandler);
router.post("/api/v1/campaigns/*/scenes", createCampaignSceneHandler);
router.put("/api/v1/campaigns/*/active-scene", setActiveCampaignSceneHandler);
router.post("/api/v1/campaigns/*/sessions", startSessionHandler);
router.delete("/api/v1/campaigns/*/sessions/*", endSessionHandler);
router.get("/api/v1/campaigns/*/sessions/active", getActiveSessionHandler);

// Asset management routes
router.post("/api/v1/assets/upload", uploadAssetHandler);
router.get("/api/v1/assets", searchAssetsHandler);
router.get("/api/v1/assets/stats", getAssetStatsHandler);
router.get("/api/v1/assets/libraries", getUserLibrariesHandler);
router.post("/api/v1/assets/libraries", createLibraryHandler);
router.get("/api/v1/assets/*", getAssetHandler);
router.get("/api/v1/assets/*/file", downloadAssetHandler);
router.put("/api/v1/assets/*", updateAssetHandler);
router.delete("/api/v1/assets/*", deleteAssetHandler);
router.post("/api/v1/assets/*/create-token", createAssetTokenHandler);
router.post("/api/v1/assets/*/create-map", createMapHandler);

// AI Content Generation routes
router.post("/api/v1/ai/generate-npc", generateNPCHandler);
router.post("/api/v1/ai/generate-quest", generateQuestHandler);
router.post("/api/v1/ai/generate-location", generateLocationHandler);
router.post("/api/v1/ai/generate-items", generateItemHandler);
router.post("/api/v1/ai/generate-encounter", generateEncounterHandler);
router.post("/api/v1/ai/generate-campaign", generateCampaignContentHandler);

// Monster management routes
router.post("/api/v1/monsters/seed", seedSRDMonstersHandler);
router.get("/api/v1/monsters", listMonstersHandler);
router.get("/api/v1/monsters/stats", getMonsterStatsHandler);
router.get("/api/v1/monsters/:id", getMonsterHandler);
router.post("/api/v1/monsters", createMonsterHandler);
router.put("/api/v1/monsters/:id", updateMonsterHandler);
router.delete("/api/v1/monsters/:id", deleteMonsterHandler);

// Content generation endpoints
router.post("/api/v1/content/encounter", generateEncounterHandler);

// AI Assistant endpoints
router.post("/api/v1/assistant/query", queryRulesHandler);
router.post("/api/v1/assistant/spell", explainSpellHandler);
router.post("/api/v1/assistant/rule", explainRuleHandler);
router.post("/api/v1/assistant/actions", suggestActionsHandler);
router.post("/api/v1/assistant/ruling", generateRulingHandler);

// Map and Grid System routes
router.post("/api/v1/maps/scenes", createSceneHandler);
router.get("/api/v1/maps/scenes", getScenesHandler);
router.get("/api/v1/maps/scenes/*", getSceneHandler);
router.put("/api/v1/maps/scenes/*", updateSceneHandler);
router.post("/api/v1/maps/scenes/*/coordinate-conversion", convertCoordinatesHandler);
router.post("/api/v1/maps/scenes/*/distance", calculateDistanceHandler);
router.post("/api/v1/maps/scenes/*/movement-path", getMovementPathHandler);
router.post("/api/v1/maps/scenes/*/lighting/sources", addLightSourceHandler);
router.delete("/api/v1/maps/scenes/*/lighting/sources/*", removeLightSourceHandler);
router.post("/api/v1/maps/scenes/*/line-of-sight", lineOfSightHandler);
router.post("/api/v1/maps/scenes/*/fog/add", addFogAreaHandler);
router.post("/api/v1/maps/scenes/*/fog/reveal", revealFogAreaHandler);
router.post("/api/v1/maps/scenes/*/measurements", createMeasurementHandler);
router.get("/api/v1/maps/scenes/*/measurements", getMeasurementsHandler);
router.post("/api/v1/maps/scenes/*/combat/initialize", initializeCombatHandler);
router.post("/api/v1/maps/scenes/*/combat/combatants", addCombatantHandler);
router.post("/api/v1/maps/scenes/*/combat/next-turn", nextTurnHandler);
router.get("/api/v1/maps/scenes/*/combat", getCombatGridHandler);
router.post("/api/v1/maps/scenes/*/effects", addGridEffectHandler);
router.post("/api/v1/maps/scenes/*/tokens", addTokenHandler);
router.put("/api/v1/maps/scenes/*/tokens/*/move", moveSceneTokenHandler);
router.put("/api/v1/maps/scenes/*/tokens/*", updateTokenHandler);
router.delete("/api/v1/maps/scenes/*/tokens/*", removeTokenHandler);
router.post("/api/v1/maps/upload", uploadMapHandler);
router.put("/api/v1/maps/scenes/*/settings", updateSceneSettingsHandler);
router.get("/api/v1/maps", getMapsHandler);

// API Scene routes (for client compatibility)
router.put("/api/v1/scenes/*/settings", updateSceneSettingsHandler);

// Provide the active scene for the authenticated user
router.get("/api/v1/scenes/active", async (ctx) => {
  try {
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Not authenticated" }));
      return;
    }

    // Find most recent campaign the user belongs to
    const campaign = await prisma.campaign.findFirst({
      where: {
        members: {
          some: {
            userId: user.id,
            status: "active",
          },
        },
      },
      orderBy: { createdAt: "desc" },
      include: { scenes: true },
    });

    if (!campaign) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "No campaigns found for user" }));
      return;
    }

    // Determine GM status
    const membership = await prisma.campaignMember.findFirst({
      where: { campaignId: campaign.id, userId: user.id },
    });
    const isGameMaster = ["gamemaster", "co-gamemaster", "admin"].includes(
      (membership?.role || "").toLowerCase(),
    );

    const targetSceneId = campaign.activeSceneId || campaign.scenes[0]?.id;
    if (!targetSceneId) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "No active scene available" }));
      return;
    }

    const dbScene = await prisma.scene.findUnique({ where: { id: targetSceneId } });
    if (!dbScene) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene not found" }));
      return;
    }

    // Minimal scene payload compatible with client `Scene` type
    const scenePayload = {
      id: dbScene.id,
      name: dbScene.name,
      gridSettings: {
        type: "square",
        size: 70,
        offsetX: 0,
        offsetY: 0,
      },
      tokens: [],
    };

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ scene: scenePayload, isGameMaster }));
  } catch (error) {
    logger.error("[server] Failed to get active scene:", error as Error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to get active scene" }));
  }
});

// OAuth routes - directly implement using passport
router.get("/api/v1/auth/discord", async (ctx) => {
  const authenticateDiscord = passport.authenticate("discord", { scope: ["identify", "email"] });
  authenticateDiscord(ctx.req as any, ctx.res as any, () => {});
});

router.get("/api/v1/auth/discord/callback", async (ctx) => {
  const authenticateCallback = passport.authenticate("discord", {
    failureRedirect: "/login?error=discord_auth_failed",
    session: true,
  });

  authenticateCallback(ctx.req as any, ctx.res as any, async () => {
    try {
      const user = (ctx.req as any).user;
      const tokens = await authManager.generateOAuthTokens(user as any);

      {
        const attrs = [
          `sessionToken=${tokens.accessToken}`,
          "HttpOnly",
          process.env.NODE_ENV === "production" ? "Secure" : "",
          "SameSite=Strict",
          "Path=/",
          `Max-Age=${7 * 24 * 60 * 60}`,
        ].filter(Boolean);
        ctx.res.setHeader("Set-Cookie", [attrs.join("; ")]);
      }

      const redirectUrl = process.env.CLIENT_URL || "http://localhost:3000";
      ctx.res.writeHead(302, { Location: `${redirectUrl}/dashboard` });
      ctx.res.end();
    } catch (error) {
      logger.error("Discord OAuth callback error:", error as Error);
      ctx.res.writeHead(302, { Location: "/login?error=auth_callback_failed" });
      ctx.res.end();
    }
  });
});

router.get("/api/v1/auth/google", async (ctx) => {
  const authenticateGoogle = passport.authenticate("google", { scope: ["profile", "email"] });
  authenticateGoogle(ctx.req as any, ctx.res as any, () => {});
});

router.get("/api/v1/auth/google/callback", async (ctx) => {
  const authenticateCallback = passport.authenticate("google", {
    failureRedirect: "/login?error=google_auth_failed",
    session: true,
  });

  authenticateCallback(ctx.req as any, ctx.res as any, async () => {
    try {
      const user = (ctx.req as any).user;
      const tokens = await authManager.generateOAuthTokens(user as any);

      {
        const attrs = [
          `sessionToken=${tokens.accessToken}`,
          "HttpOnly",
          process.env.NODE_ENV === "production" ? "Secure" : "",
          "SameSite=Strict",
          "Path=/",
          `Max-Age=${7 * 24 * 60 * 60}`,
        ].filter(Boolean);
        ctx.res.setHeader("Set-Cookie", [attrs.join("; ")]);
      }

      const redirectUrl = process.env.CLIENT_URL || "http://localhost:3000";
      ctx.res.writeHead(302, { Location: `${redirectUrl}/dashboard` });
      ctx.res.end();
    } catch (error) {
      logger.error("Google OAuth callback error:", error as Error);
      ctx.res.writeHead(302, { Location: "/login?error=auth_callback_failed" });
      ctx.res.end();
    }
  });
});

router.post("/auth/logout", async (ctx) => {
  (ctx.req as any).logout((err: unknown) => {
    if (err) {
      ctx.res.writeHead(500, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Logout failed" }));
      return;
    }

    ctx.res.setHeader("Set-Cookie", [
      "sessionToken=; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ]);
    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, message: "Logged out successfully" }));
  });
});

router.get("/auth/me", async (ctx) => {
  try {
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Not authenticated" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        id: (user as any).id,
        username: (user as any).username,
        email: (user as any).email,
        avatar: (user as any).avatar,
        createdAt: (user as any).createdAt,
      } as any),
    );
  } catch (error) {
    logger.error("Get user info error:", error as Error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to get user info" }));
  }
});

// Add versioned API endpoint for client compatibility
router.get("/api/v1/auth/me", async (ctx) => {
  try {
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Not authenticated" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        user: {
          id: (user as any).id,
          username: (user as any).username,
          email: (user as any).email,
          avatar: (user as any).avatar,
          createdAt: (user as any).createdAt,
        },
      }),
    );
  } catch (error) {
    logger.error("Get user info error:", error as Error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Failed to get user info" }));
  }
});

router.post("/api/v1/auth/logout", async (ctx) => {
  ctx.res.writeHead(200, { "Content-Type": "application/json" });
  ctx.res.end(JSON.stringify({ success: true, message: "Logged out successfully" }));
});

// Health check endpoints for deployment pipeline
router.get("/health", (ctx) => {
  ctx.res.writeHead(200, { "Content-Type": "application/json" });
  ctx.res.end(
    JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
    }),
  );
});

router.get("/api/v1/health", (ctx) => {
  ctx.res.writeHead(200, { "Content-Type": "application/json" });
  ctx.res.end(
    JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        database: "connected",
        websocket: vttWebSocketServer ? "active" : "inactive",
        gameManager: "running",
        mapService: "ready",
        aiContent: "available",
        assetManager: "ready",
      },
      endpoints: {
        games: "/api/v1/games",
        characters: "/api/v1/characters",
        campaigns: "/api/v1/campaigns",
        assets: "/api/v1/assets",
        maps: "/api/v1/maps",
        ai: "/api/v1/ai",
      },
    }),
  );
});

// Favicon handlers to prevent 404s
router.get("/favicon.ico", (ctx) => {
  ctx.res.writeHead(204);
  ctx.res.end();
});
router.get("/favicon-16x16.png", (ctx) => {
  ctx.res.writeHead(204);
  ctx.res.end();
});
router.get("/favicon-32x32.png", (ctx) => {
  ctx.res.writeHead(204);
  ctx.res.end();
});

// HTTP server - use Express app
const server = createServer(app);

// WebSocket setup with explicit upgrade handling
const vttWebSocketServer = new VTTWebSocketServer(server, prisma);
// Enable Socket.IO compatibility for existing client integrations
const _vttSocketManager = new VTTSocketManager(server as any, prisma);

// Handle WebSocket upgrade requests explicitly
server.on("upgrade", (request, socket, head) => {
  try {
    const reqUrl = request.url || "/";
    const host = request.headers.host || `localhost:${PORT}`;
    // Parse URL to extract pathname only (ignore query string)
    const parsed = new URL(reqUrl, `http://${host}`);
    const pathOnly = parsed.pathname;
    const remote = (request.socket && (request.socket as any).remoteAddress) || "unknown";
    const origin = (request.headers.origin as string | undefined) || "";
    const ua = (request.headers["user-agent"] as string | undefined) || "";
    const upgradeHdr = (request.headers["upgrade"] as string | undefined) || "";
    const connectionHdr = (request.headers["connection"] as string | undefined) || "";

    logger.info("[ws:upgrade] request", {
      url: reqUrl,
      host,
      path: pathOnly,
      origin,
      ua,
      remote,
      upgradeHdr,
      connectionHdr,
    });

    if (pathOnly === "/ws") {
      logger.info("[ws:upgrade] accepting", { path: pathOnly });
      // Let the WebSocketServer handle the upgrade
      vttWebSocketServer.handleUpgrade(request, socket, head);
    } else {
      // Do not handle other upgrade paths here (e.g., Socket.IO '/socket.io/')
      // Allow other listeners (such as Socket.IO) to process this upgrade.
      return;
    }
  } catch (e) {
    logger.warn("[ws:upgrade] parse error", { url: request.url, error: (e as Error)?.message });
    // Fallback: accept if the raw URL clearly targets /ws
    if ((request.url || "").startsWith("/ws")) {
      logger.info("[ws:upgrade] fallback accepting raw /ws", { url: request.url });
      vttWebSocketServer.handleUpgrade(request, socket, head);
    }
    return;
  }
});

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info(`[server] ${signal} received, shutting down gracefully`);
  try {
    await DatabaseManager.disconnect();
  } catch (e) {
    logger.error("[server] Error during shutdown", e as Error);
  }
  // Close HTTP server
  server.close(() => {
    process.exit(0);
  });
  // Fallback exit after timeout
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));

process.on("SIGINT", () => void shutdown("SIGINT"));

// Start server
async function startServer() {
  try {
    // Attempt DB connection, but don't prevent server from starting if it fails
    try {
      await DatabaseManager.connect();
    } catch (error) {
      logger.error(
        "[server] Database connection failed at startup - continuing in degraded mode",
        error as Error,
      );
    }

    // Initialize health checks regardless of DB state
    addDatabaseHealthCheck(prisma);
    addAIServiceHealthCheck();

    server.listen(PORT, () => {
      logger.info(`[Server] Listening on port`, { port: PORT });
      logger.info(
        `[Server] Database: ${DatabaseManager.getConnectionStatus() ? "connected" : "disconnected"}`,
      );
    });
  } catch (error) {
    logger.error("[server] Failed to start:", error as Error);
    // Do not exit abruptly; allow external supervisor to handle restarts
  }
}

startServer();
