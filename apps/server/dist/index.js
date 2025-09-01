import "./env";
import { logger } from "@vtt/logging";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { loggingMiddleware } from "./middleware/logging";
import { errorMiddleware } from "./middleware/error";
import { requestIdMiddleware } from "./middleware/requestId";
import { securityHeadersMiddleware } from "./middleware/security";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { corsMiddleware } from "./middleware/cors";
import { csrfMiddleware, csrfTokenMiddleware } from "./middleware/csrf";
import { metricsMiddleware, addDatabaseHealthCheck, addAIServiceHealthCheck } from "./middleware/metrics";
import session from "express-session";
import passport from "passport";
import { listProvidersHandler, textToImageHandler, depthHandler, segmentationHandler, } from "./routes/ai";
import { getUsersHandler, createUserHandler } from "./routes/users";
import { generateCharacterHandler, getGenerationStatusHandler, retryGenerationStepHandler, getGenerationHistoryHandler, } from "./routes/genesis";
import { getTacticalDecisionHandler, simulateCombatHandler, analyzeCombatHandler, getActiveSimulationsHandler, } from "./routes/combat";
import { healthHandler } from "./routes/health";
import { livenessHandler, readinessHandler } from "./routes/healthz";
import { swaggerDocsHandler, swaggerJsonHandler } from "./routes/docs";
import { loginPageHandler } from "./routes/login";
import { createGameHandler, getGameHandler, joinGameHandler, leaveGameHandler, listGamesHandler, createTokenHandler, moveTokenHandler, rollDiceHandler, } from "./routes/games";
import { createCharacterHandler, getCharacterHandler, getUserCharactersHandler, updateCharacterHandler, deleteCharacterHandler, getCharacterTemplatesHandler, levelUpCharacterHandler, characterRestHandler, } from "./routes/characters";
import { createCampaignHandler, getCampaignHandler, getUserCampaignsHandler, updateCampaignHandler, deleteCampaignHandler, addPlayerHandler, removePlayerHandler, addCharacterToCampaignHandler, removeCharacterFromCampaignHandler, archiveCampaignHandler, getCampaignStatsHandler, getCampaignScenesHandler, createCampaignSceneHandler, setActiveCampaignSceneHandler, startSessionHandler, endSessionHandler, getActiveSessionHandler, } from "./routes/campaigns";
import { uploadAssetHandler, getAssetHandler, downloadAssetHandler, searchAssetsHandler, updateAssetHandler, deleteAssetHandler, createTokenHandler as createAssetTokenHandler, createMapHandler, getAssetStatsHandler, getUserLibrariesHandler, createLibraryHandler, } from "./routes/assets";
import { generateNPCHandler, generateLocationHandler, generateQuestHandler, generateItemHandler, generateEncounterHandler, generateCampaignContentHandler, } from "./routes/content";
import { queryRulesHandler, explainSpellHandler, explainRuleHandler, suggestActionsHandler, generateRulingHandler, } from "./routes/assistant";
import { createSceneHandler, getSceneHandler, updateSceneHandler, getScenesHandler, convertCoordinatesHandler, calculateDistanceHandler, getMovementPathHandler, addLightSourceHandler, removeLightSourceHandler, lineOfSightHandler, addFogAreaHandler, revealFogAreaHandler, createMeasurementHandler, getMeasurementsHandler, initializeCombatHandler, addCombatantHandler, nextTurnHandler, getCombatGridHandler, addGridEffectHandler, addTokenHandler, moveTokenHandler as moveSceneTokenHandler, updateTokenHandler, removeTokenHandler, uploadMapHandler, updateSceneSettingsHandler, getMapsHandler, } from "./routes/maps";
import { seedSRDMonstersHandler, listMonstersHandler, getMonsterHandler, createMonsterHandler, updateMonsterHandler, deleteMonsterHandler, getMonsterStatsHandler, } from "./routes/monsters";
import { healthCheckHandler, livenessProbeHandler, readinessProbeHandler, metricsHandler, prometheusMetricsHandler, } from "./routes/metrics";
import { createUnifiedWebSocketManager } from "./websocket/UnifiedWebSocketManager";
import { DatabaseManager } from "./database/connection";
import { initializeAuth } from "./auth";
import { Router } from "./router/router";
const prisma = DatabaseManager.getInstance();
const PORT = Number(process.env.PORT ?? 8080);
// Initialize authentication
const { authManager, oauthManager, oauthRoutes } = initializeAuth();
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
// Router setup
const router = new Router();
// Middleware
// Order matters: error wraps everything, then set request id so downstream can log it
router.use(errorMiddleware);
router.use(requestIdMiddleware);
router.use(corsMiddleware); // CORS must come early for preflight requests
router.use(csrfMiddleware); // CSRF protection after CORS
router.use(csrfTokenMiddleware); // Add CSRF token to response headers
router.use(securityHeadersMiddleware);
router.use(rateLimitMiddleware);
router.use(metricsMiddleware);
// Session and passport middleware
router.use(async (ctx, next) => {
    // Add session middleware to context
    const sessionMiddleware = session(sessionConfig);
    await new Promise((resolve) => {
        sessionMiddleware(ctx.req, ctx.res, () => {
            // Initialize passport
            passport.initialize()(ctx.req, ctx.res, () => {
                passport.session()(ctx.req, ctx.res, () => {
                    resolve();
                });
            });
        });
    });
    return next();
});
router.use(loggingMiddleware);
// Routes
router.get("/ai/providers", listProvidersHandler);
router.post("/ai/text-to-image", textToImageHandler);
router.post("/ai/depth", depthHandler);
router.post("/ai/segmentation", segmentationHandler);
// Genesis AI Routes
router.post("/api/genesis/generate", generateCharacterHandler);
router.get("/api/genesis/status/:jobId", getGenerationStatusHandler);
router.post("/api/genesis/retry/:jobId/:step", retryGenerationStepHandler);
router.get("/api/genesis/history", getGenerationHistoryHandler);
// Combat AI Routes
router.post("/api/combat/tactical-decision", getTacticalDecisionHandler);
router.post("/api/combat/simulate", simulateCombatHandler);
// router.get("/api/combat/simulation/:simulationId", getSimulationHandler); // Handler not exported
// router.post("/api/combat/positioning", getPositioningHandler); // Handler not exported
router.post("/api/combat/analyze", analyzeCombatHandler);
router.get("/api/combat/simulations", getActiveSimulationsHandler);
// Health check and metrics endpoints
router.get("/api/health", healthCheckHandler);
router.get("/api/health/live", livenessProbeHandler);
router.get("/api/health/ready", readinessProbeHandler);
router.get("/api/metrics", metricsHandler);
router.get("/api/metrics/prometheus", prometheusMetricsHandler);
// Legacy health check endpoints
router.get("/health", healthHandler); // legacy: readiness
router.get("/livez", livenessHandler);
router.get("/readyz", readinessHandler);
router.get("/users", getUsersHandler);
router.post("/users", createUserHandler);
// OAuth routes are registered directly above
router.get("/docs", swaggerDocsHandler);
router.get("/api-docs.json", swaggerJsonHandler);
router.get("/login", loginPageHandler);
// Game management routes
router.post("/games", createGameHandler);
router.get("/games", listGamesHandler);
router.get("/games/*", getGameHandler);
router.post("/games/*/join", joinGameHandler);
router.post("/games/*/leave", leaveGameHandler);
router.post("/games/*/tokens", createTokenHandler);
router.post("/games/*/tokens/*/move", moveTokenHandler);
router.post("/games/*/dice", rollDiceHandler);
// Character management routes
router.post("/characters", createCharacterHandler);
router.get("/characters", getUserCharactersHandler);
router.get("/characters/*", getCharacterHandler);
router.put("/characters/*", updateCharacterHandler);
router.delete("/characters/*", deleteCharacterHandler);
router.get("/character-templates", getCharacterTemplatesHandler);
router.post("/characters/*/level-up", levelUpCharacterHandler);
router.post("/characters/*/rest", characterRestHandler);
// Campaign management routes
router.post("/campaigns", createCampaignHandler);
router.get("/campaigns", getUserCampaignsHandler);
router.get("/campaigns/*", getCampaignHandler);
router.put("/campaigns/*", updateCampaignHandler);
router.delete("/campaigns/*", deleteCampaignHandler);
router.post("/campaigns/*/players", addPlayerHandler);
router.delete("/campaigns/*/players/*", removePlayerHandler);
router.post("/campaigns/*/characters", addCharacterToCampaignHandler);
router.delete("/campaigns/*/characters/*", removeCharacterFromCampaignHandler);
router.post("/campaigns/*/archive", archiveCampaignHandler);
router.get("/campaigns/*/stats", getCampaignStatsHandler);
router.get("/campaigns/*/scenes", getCampaignScenesHandler);
router.post("/campaigns/*/scenes", createCampaignSceneHandler);
router.put("/campaigns/*/active-scene", setActiveCampaignSceneHandler);
router.post("/campaigns/*/sessions", startSessionHandler);
router.delete("/campaigns/*/sessions/*", endSessionHandler);
router.get("/campaigns/*/sessions/active", getActiveSessionHandler);
// Asset management routes
router.post("/assets/upload", uploadAssetHandler);
router.get("/assets", searchAssetsHandler);
router.get("/assets/stats", getAssetStatsHandler);
router.get("/assets/libraries", getUserLibrariesHandler);
router.post("/assets/libraries", createLibraryHandler);
router.get("/assets/*", getAssetHandler);
router.get("/assets/*/file", downloadAssetHandler);
router.put("/assets/*", updateAssetHandler);
router.delete("/assets/*", deleteAssetHandler);
router.post("/assets/*/create-token", createAssetTokenHandler);
router.post("/assets/*/create-map", createMapHandler);
// AI Content Generation routes
router.post("/ai/generate-npc", generateNPCHandler);
router.post("/ai/generate-quest", generateQuestHandler);
router.post("/ai/generate-location", generateLocationHandler);
router.post("/ai/generate-items", generateItemHandler);
router.post("/ai/generate-encounter", generateEncounterHandler);
router.post("/ai/generate-campaign", generateCampaignContentHandler);
// Monster management routes
router.post("/api/monsters/seed", seedSRDMonstersHandler);
router.get("/api/monsters", listMonstersHandler);
router.get("/api/monsters/stats", getMonsterStatsHandler);
router.get("/api/monsters/:id", getMonsterHandler);
router.post("/api/monsters", createMonsterHandler);
router.put("/api/monsters/:id", updateMonsterHandler);
router.delete("/api/monsters/:id", deleteMonsterHandler);
// Content generation endpoints
router.post("/api/content/encounter", generateEncounterHandler);
// AI Assistant endpoints
router.post("/api/assistant/query", queryRulesHandler);
router.post("/api/assistant/spell", explainSpellHandler);
router.post("/api/assistant/rule", explainRuleHandler);
router.post("/api/assistant/actions", suggestActionsHandler);
router.post("/api/assistant/ruling", generateRulingHandler);
// Map and Grid System routes
router.post("/maps/scenes", createSceneHandler);
router.get("/maps/scenes", getScenesHandler);
router.get("/maps/scenes/*", getSceneHandler);
router.put("/maps/scenes/*", updateSceneHandler);
router.post("/maps/scenes/*/coordinate-conversion", convertCoordinatesHandler);
router.post("/maps/scenes/*/distance", calculateDistanceHandler);
router.post("/maps/scenes/*/movement-path", getMovementPathHandler);
router.post("/maps/scenes/*/lighting/sources", addLightSourceHandler);
router.delete("/maps/scenes/*/lighting/sources/*", removeLightSourceHandler);
router.post("/maps/scenes/*/line-of-sight", lineOfSightHandler);
router.post("/maps/scenes/*/fog/add", addFogAreaHandler);
router.post("/maps/scenes/*/fog/reveal", revealFogAreaHandler);
router.post("/maps/scenes/*/measurements", createMeasurementHandler);
router.get("/maps/scenes/*/measurements", getMeasurementsHandler);
router.post("/maps/scenes/*/combat/initialize", initializeCombatHandler);
router.post("/maps/scenes/*/combat/combatants", addCombatantHandler);
router.post("/maps/scenes/*/combat/next-turn", nextTurnHandler);
router.get("/maps/scenes/*/combat", getCombatGridHandler);
router.post("/maps/scenes/*/effects", addGridEffectHandler);
router.post("/maps/scenes/*/tokens", addTokenHandler);
router.put("/maps/scenes/*/tokens/*/move", moveSceneTokenHandler);
router.put("/maps/scenes/*/tokens/*", updateTokenHandler);
router.delete("/maps/scenes/*/tokens/*", removeTokenHandler);
router.post("/maps/upload", uploadMapHandler);
router.put("/maps/scenes/*/settings", updateSceneSettingsHandler);
router.get("/maps", getMapsHandler);
// API Scene routes (for client compatibility)
router.put("/api/scenes/*/settings", updateSceneSettingsHandler);
// OAuth routes - directly implement using passport
router.get("/auth/discord", async (ctx) => {
    const authenticateDiscord = passport.authenticate("discord", { scope: ["identify", "email"] });
    authenticateDiscord(ctx.req, ctx.res, () => { });
});
router.get("/auth/discord/callback", async (ctx) => {
    const authenticateCallback = passport.authenticate("discord", {
        failureRedirect: "/login?error=discord_auth_failed",
        session: true,
    });
    authenticateCallback(ctx.req, ctx.res, async () => {
        try {
            const user = ctx.req.user;
            const tokens = await authManager.generateOAuthTokens(user);
            ctx.res.setHeader("Set-Cookie", [
                `sessionToken=${tokens.accessToken}; HttpOnly; Secure=${process.env.NODE_ENV === "production"}; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
            ]);
            const redirectUrl = process.env.CLIENT_URL || "http://localhost:3000";
            ctx.res.writeHead(302, { Location: `${redirectUrl}/dashboard` });
            ctx.res.end();
        }
        catch (error) {
            logger.error("Discord OAuth callback error:", error);
            ctx.res.writeHead(302, { Location: "/login?error=auth_callback_failed" });
            ctx.res.end();
        }
    });
});
router.get("/auth/google", async (ctx) => {
    const authenticateGoogle = passport.authenticate("google", { scope: ["profile", "email"] });
    authenticateGoogle(ctx.req, ctx.res, () => { });
});
router.get("/auth/google/callback", async (ctx) => {
    const authenticateCallback = passport.authenticate("google", {
        failureRedirect: "/login?error=google_auth_failed",
        session: true,
    });
    authenticateCallback(ctx.req, ctx.res, async () => {
        try {
            const user = ctx.req.user;
            const tokens = await authManager.generateOAuthTokens(user);
            ctx.res.setHeader("Set-Cookie", [
                `sessionToken=${tokens.accessToken}; HttpOnly; Secure=${process.env.NODE_ENV === "production"}; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
            ]);
            const redirectUrl = process.env.CLIENT_URL || "http://localhost:3000";
            ctx.res.writeHead(302, { Location: `${redirectUrl}/dashboard` });
            ctx.res.end();
        }
        catch (error) {
            logger.error("Google OAuth callback error:", error);
            ctx.res.writeHead(302, { Location: "/login?error=auth_callback_failed" });
            ctx.res.end();
        }
    });
});
router.post("/auth/logout", async (ctx) => {
    ctx.req.logout((err) => {
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
        const user = ctx.req.user;
        if (!user) {
            ctx.res.writeHead(401, { "Content-Type": "application/json" });
            ctx.res.end(JSON.stringify({ error: "Not authenticated" }));
            return;
        }
        ctx.res.writeHead(200, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify({
            id: user.id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            createdAt: user.createdAt,
        }));
    }
    catch (error) {
        logger.error("Get user info error:", error);
        ctx.res.writeHead(500, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify({ error: "Failed to get user info" }));
    }
});
// Health check endpoints for deployment pipeline
router.get("/health", (ctx) => {
    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0",
    }));
});
router.get("/api/v1/health", (ctx) => {
    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: {
            database: "connected",
            websocket: wsManager ? "active" : "inactive",
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
    }));
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
// HTTP server
const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    // requestId will be set by requestIdMiddleware; initialize to empty for type safety
    const ctx = { req, res, prisma, url, requestId: "" };
    const handled = await router.handle(ctx);
    if (!handled) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
    }
});
// WebSocket setup
const wss = new WebSocketServer({ server });
const wsManager = createUnifiedWebSocketManager(wss);
// Graceful shutdown
async function shutdown(signal) {
    logger.info(`[server] ${signal} received, shutting down gracefully`);
    try {
        await Promise.allSettled([DatabaseManager.disconnect(), wsManager.shutdown?.()]);
    }
    catch (e) {
        logger.error("[server] Error during shutdown", e);
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
        await DatabaseManager.connect();
        // Initialize health checks
        addDatabaseHealthCheck(prisma);
        addAIServiceHealthCheck();
        server.listen(PORT, () => {
            logger.info(`[Server] Listening on port`, { port: PORT });
            console.log(`[server] Database: ${DatabaseManager.getConnectionStatus() ? "connected" : "disconnected"}`);
        });
    }
    catch (error) {
        logger.error("[server] Failed to start:", error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=index.js.map