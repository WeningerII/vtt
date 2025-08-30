"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
require("./env");
var logging_1 = require("@vtt/logging");
var http_1 = require("http");
var ws_1 = require("ws");
var logging_2 = require("./middleware/logging");
var error_1 = require("./middleware/error");
var requestId_1 = require("./middleware/requestId");
var security_1 = require("./middleware/security");
var rateLimit_1 = require("./middleware/rateLimit");
var cors_1 = require("./middleware/cors");
var csrf_1 = require("./middleware/csrf");
var express_session_1 = require("express-session");
var passport_1 = require("passport");
var ai_1 = require("./routes/ai");
var users_1 = require("./routes/users");
var genesis_1 = require("./routes/genesis");
var combat_1 = require("./routes/combat");
var health_1 = require("./routes/health");
var healthz_1 = require("./routes/healthz");
var docs_1 = require("./routes/docs");
var login_1 = require("./routes/login");
var games_1 = require("./routes/games");
var characters_1 = require("./routes/characters");
var campaigns_1 = require("./routes/campaigns");
var assets_1 = require("./routes/assets");
var content_1 = require("./routes/content");
var assistant_1 = require("./routes/assistant");
var maps_1 = require("./routes/maps");
var monsters_1 = require("./routes/monsters");
var manager_1 = require("./websocket/manager");
var connection_1 = require("./database/connection");
var auth_1 = require("./auth");
var router_1 = require("./router/router");
var prisma = connection_1.DatabaseManager.getInstance();
var PORT = Number((_a = process.env.PORT) !== null && _a !== void 0 ? _a : 8080);
// Initialize authentication
var _b = (0, auth_1.initializeAuth)(), authManager = _b.authManager, oauthManager = _b.oauthManager, oauthRoutes = _b.oauthRoutes;
// Session configuration
var sessionConfig = {
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
var router = new router_1.Router();
// Middleware
// Order matters: error wraps everything, then set request id so downstream can log it
router.use(error_1.errorMiddleware);
router.use(requestId_1.requestIdMiddleware);
router.use(cors_1.corsMiddleware); // CORS must come early for preflight requests
router.use(csrf_1.csrfMiddleware); // CSRF protection after CORS
router.use(csrf_1.csrfTokenMiddleware); // Add CSRF token to response headers
router.use(security_1.securityHeadersMiddleware);
router.use(rateLimit_1.rateLimitMiddleware);
// Session and passport middleware
router.use(function (ctx, next) { return __awaiter(void 0, void 0, void 0, function () {
    var sessionMiddleware;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                sessionMiddleware = (0, express_session_1.default)(sessionConfig);
                return [4 /*yield*/, new Promise(function (resolve) {
                        sessionMiddleware(ctx.req, ctx.res, function () {
                            // Initialize passport
                            passport_1.default.initialize()(ctx.req, ctx.res, function () {
                                passport_1.default.session()(ctx.req, ctx.res, function () {
                                    resolve();
                                });
                            });
                        });
                    })];
            case 1:
                _a.sent();
                return [2 /*return*/, next()];
        }
    });
}); });
router.use(logging_2.loggingMiddleware);
// Routes
router.get("/ai/providers", ai_1.listProvidersHandler);
router.post("/ai/text-to-image", ai_1.textToImageHandler);
router.post("/ai/depth", ai_1.depthHandler);
router.post("/ai/segmentation", ai_1.segmentationHandler);
// Genesis AI Routes
router.post("/api/genesis/generate", genesis_1.generateCharacterHandler);
router.get("/api/genesis/status/:jobId", genesis_1.getGenerationStatusHandler);
router.post("/api/genesis/retry/:jobId/:step", genesis_1.retryGenerationStepHandler);
router.get("/api/genesis/history", genesis_1.getGenerationHistoryHandler);
// Combat AI Routes
router.post("/api/combat/tactical-decision", combat_1.getTacticalDecisionHandler);
router.post("/api/combat/simulate", combat_1.simulateCombatHandler);
// router.get("/api/combat/simulation/:simulationId", getSimulationHandler); // Handler not exported
// router.post("/api/combat/positioning", getPositioningHandler); // Handler not exported
router.post("/api/combat/analyze", combat_1.analyzeCombatHandler);
router.get("/api/combat/simulations", combat_1.getActiveSimulationsHandler);
router.get("/health", health_1.healthHandler); // legacy: readiness
router.get("/livez", healthz_1.livenessHandler);
router.get("/readyz", healthz_1.readinessHandler);
router.get("/users", users_1.getUsersHandler);
router.post("/users", users_1.createUserHandler);
// OAuth routes are registered directly above
router.get("/docs", docs_1.swaggerDocsHandler);
router.get("/api-docs.json", docs_1.swaggerJsonHandler);
router.get("/login", login_1.loginPageHandler);
// Game management routes
router.post("/games", games_1.createGameHandler);
router.get("/games", games_1.listGamesHandler);
router.get("/games/*", games_1.getGameHandler);
router.post("/games/*/join", games_1.joinGameHandler);
router.post("/games/*/leave", games_1.leaveGameHandler);
router.post("/games/*/tokens", games_1.createTokenHandler);
router.post("/games/*/tokens/*/move", games_1.moveTokenHandler);
router.post("/games/*/dice", games_1.rollDiceHandler);
// Character management routes
router.post("/characters", characters_1.createCharacterHandler);
router.get("/characters", characters_1.getUserCharactersHandler);
router.get("/characters/*", characters_1.getCharacterHandler);
router.put("/characters/*", characters_1.updateCharacterHandler);
router.delete("/characters/*", characters_1.deleteCharacterHandler);
router.get("/character-templates", characters_1.getCharacterTemplatesHandler);
router.post("/characters/*/level-up", characters_1.levelUpCharacterHandler);
router.post("/characters/*/rest", characters_1.characterRestHandler);
// Campaign management routes
router.post("/campaigns", campaigns_1.createCampaignHandler);
router.get("/campaigns", campaigns_1.getUserCampaignsHandler);
router.get("/campaigns/*", campaigns_1.getCampaignHandler);
router.put("/campaigns/*", campaigns_1.updateCampaignHandler);
router.delete("/campaigns/*", campaigns_1.deleteCampaignHandler);
router.post("/campaigns/*/players", campaigns_1.addPlayerHandler);
router.delete("/campaigns/*/players/*", campaigns_1.removePlayerHandler);
router.post("/campaigns/*/characters", campaigns_1.addCharacterToCampaignHandler);
router.delete("/campaigns/*/characters/*", campaigns_1.removeCharacterFromCampaignHandler);
router.post("/campaigns/*/archive", campaigns_1.archiveCampaignHandler);
router.get("/campaigns/*/stats", campaigns_1.getCampaignStatsHandler);
router.get("/campaigns/*/scenes", campaigns_1.getCampaignScenesHandler);
router.post("/campaigns/*/scenes", campaigns_1.createCampaignSceneHandler);
router.put("/campaigns/*/active-scene", campaigns_1.setActiveCampaignSceneHandler);
router.post("/campaigns/*/sessions", campaigns_1.startSessionHandler);
router.delete("/campaigns/*/sessions/*", campaigns_1.endSessionHandler);
router.get("/campaigns/*/sessions/active", campaigns_1.getActiveSessionHandler);
// Asset management routes
router.post("/assets/upload", assets_1.uploadAssetHandler);
router.get("/assets", assets_1.searchAssetsHandler);
router.get("/assets/stats", assets_1.getAssetStatsHandler);
router.get("/assets/libraries", assets_1.getUserLibrariesHandler);
router.post("/assets/libraries", assets_1.createLibraryHandler);
router.get("/assets/*", assets_1.getAssetHandler);
router.get("/assets/*/file", assets_1.downloadAssetHandler);
router.put("/assets/*", assets_1.updateAssetHandler);
router.delete("/assets/*", assets_1.deleteAssetHandler);
router.post("/assets/*/create-token", assets_1.createTokenHandler);
router.post("/assets/*/create-map", assets_1.createMapHandler);
// AI Content Generation routes
router.post("/ai/generate-npc", content_1.generateNPCHandler);
router.post("/ai/generate-quest", content_1.generateQuestHandler);
router.post("/ai/generate-location", content_1.generateLocationHandler);
router.post("/ai/generate-items", content_1.generateItemHandler);
router.post("/ai/generate-encounter", content_1.generateEncounterHandler);
router.post("/ai/generate-campaign", content_1.generateCampaignContentHandler);
// Monster management routes
router.post("/api/monsters/seed", monsters_1.seedSRDMonstersHandler);
router.get("/api/monsters", monsters_1.listMonstersHandler);
router.get("/api/monsters/stats", monsters_1.getMonsterStatsHandler);
router.get("/api/monsters/:id", monsters_1.getMonsterHandler);
router.post("/api/monsters", monsters_1.createMonsterHandler);
router.put("/api/monsters/:id", monsters_1.updateMonsterHandler);
router.delete("/api/monsters/:id", monsters_1.deleteMonsterHandler);
// Content generation endpoints
router.post("/api/content/encounter", content_1.generateEncounterHandler);
// AI Assistant endpoints
router.post("/api/assistant/query", assistant_1.queryRulesHandler);
router.post("/api/assistant/spell", assistant_1.explainSpellHandler);
router.post("/api/assistant/rule", assistant_1.explainRuleHandler);
router.post("/api/assistant/actions", assistant_1.suggestActionsHandler);
router.post("/api/assistant/ruling", assistant_1.generateRulingHandler);
// Map and Grid System routes
router.post("/maps/scenes", maps_1.createSceneHandler);
router.get("/maps/scenes", maps_1.getScenesHandler);
router.get("/maps/scenes/*", maps_1.getSceneHandler);
router.put("/maps/scenes/*", maps_1.updateSceneHandler);
router.post("/maps/scenes/*/coordinate-conversion", maps_1.convertCoordinatesHandler);
router.post("/maps/scenes/*/distance", maps_1.calculateDistanceHandler);
router.post("/maps/scenes/*/movement-path", maps_1.getMovementPathHandler);
router.post("/maps/scenes/*/lighting/sources", maps_1.addLightSourceHandler);
router.delete("/maps/scenes/*/lighting/sources/*", maps_1.removeLightSourceHandler);
router.post("/maps/scenes/*/line-of-sight", maps_1.lineOfSightHandler);
router.post("/maps/scenes/*/fog/add", maps_1.addFogAreaHandler);
router.post("/maps/scenes/*/fog/reveal", maps_1.revealFogAreaHandler);
router.post("/maps/scenes/*/measurements", maps_1.createMeasurementHandler);
router.get("/maps/scenes/*/measurements", maps_1.getMeasurementsHandler);
router.post("/maps/scenes/*/combat/initialize", maps_1.initializeCombatHandler);
router.post("/maps/scenes/*/combat/combatants", maps_1.addCombatantHandler);
router.post("/maps/scenes/*/combat/next-turn", maps_1.nextTurnHandler);
router.get("/maps/scenes/*/combat", maps_1.getCombatGridHandler);
router.post("/maps/scenes/*/effects", maps_1.addGridEffectHandler);
router.post("/maps/scenes/*/tokens", maps_1.addTokenHandler);
router.put("/maps/scenes/*/tokens/*/move", maps_1.moveTokenHandler);
router.put("/maps/scenes/*/tokens/*", maps_1.updateTokenHandler);
router.delete("/maps/scenes/*/tokens/*", maps_1.removeTokenHandler);
router.post("/maps/upload", maps_1.uploadMapHandler);
router.put("/maps/scenes/*/settings", maps_1.updateSceneSettingsHandler);
router.get("/maps", maps_1.getMapsHandler);
// API Scene routes (for client compatibility)
router.put("/api/scenes/*/settings", maps_1.updateSceneSettingsHandler);
// OAuth routes - directly implement using passport
router.get("/auth/discord", function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var authenticateDiscord;
    return __generator(this, function (_a) {
        authenticateDiscord = passport_1.default.authenticate("discord", { scope: ["identify", "email"] });
        authenticateDiscord(ctx.req, ctx.res, function () { });
        return [2 /*return*/];
    });
}); });
router.get("/auth/discord/callback", function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var authenticateCallback;
    return __generator(this, function (_a) {
        authenticateCallback = passport_1.default.authenticate("discord", {
            failureRedirect: "/login?error=discord_auth_failed",
            session: true,
        });
        authenticateCallback(ctx.req, ctx.res, function () { return __awaiter(void 0, void 0, void 0, function () {
            var user, tokens, redirectUrl, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        user = ctx.req.user;
                        return [4 /*yield*/, authManager.generateOAuthTokens(user)];
                    case 1:
                        tokens = _a.sent();
                        ctx.res.setHeader("Set-Cookie", [
                            "sessionToken=".concat(tokens.accessToken, "; HttpOnly; Secure=").concat(process.env.NODE_ENV === "production", "; SameSite=Strict; Max-Age=").concat(7 * 24 * 60 * 60),
                        ]);
                        redirectUrl = process.env.CLIENT_URL || "http://localhost:3000";
                        ctx.res.writeHead(302, { Location: "".concat(redirectUrl, "/dashboard") });
                        ctx.res.end();
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _a.sent();
                        logging_1.logger.error("Discord OAuth callback error:", error_2);
                        ctx.res.writeHead(302, { Location: "/login?error=auth_callback_failed" });
                        ctx.res.end();
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); });
router.get("/auth/google", function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var authenticateGoogle;
    return __generator(this, function (_a) {
        authenticateGoogle = passport_1.default.authenticate("google", { scope: ["profile", "email"] });
        authenticateGoogle(ctx.req, ctx.res, function () { });
        return [2 /*return*/];
    });
}); });
router.get("/auth/google/callback", function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var authenticateCallback;
    return __generator(this, function (_a) {
        authenticateCallback = passport_1.default.authenticate("google", {
            failureRedirect: "/login?error=google_auth_failed",
            session: true,
        });
        authenticateCallback(ctx.req, ctx.res, function () { return __awaiter(void 0, void 0, void 0, function () {
            var user, tokens, redirectUrl, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        user = ctx.req.user;
                        return [4 /*yield*/, authManager.generateOAuthTokens(user)];
                    case 1:
                        tokens = _a.sent();
                        ctx.res.setHeader("Set-Cookie", [
                            "sessionToken=".concat(tokens.accessToken, "; HttpOnly; Secure=").concat(process.env.NODE_ENV === "production", "; SameSite=Strict; Max-Age=").concat(7 * 24 * 60 * 60),
                        ]);
                        redirectUrl = process.env.CLIENT_URL || "http://localhost:3000";
                        ctx.res.writeHead(302, { Location: "".concat(redirectUrl, "/dashboard") });
                        ctx.res.end();
                        return [3 /*break*/, 3];
                    case 2:
                        error_3 = _a.sent();
                        logging_1.logger.error("Google OAuth callback error:", error_3);
                        ctx.res.writeHead(302, { Location: "/login?error=auth_callback_failed" });
                        ctx.res.end();
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); });
router.post("/auth/logout", function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        ctx.req.logout(function (err) {
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
        return [2 /*return*/];
    });
}); });
router.get("/auth/me", function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var user;
    return __generator(this, function (_a) {
        try {
            user = ctx.req.user;
            if (!user) {
                ctx.res.writeHead(401, { "Content-Type": "application/json" });
                ctx.res.end(JSON.stringify({ error: "Not authenticated" }));
                return [2 /*return*/];
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
            logging_1.logger.error("Get user info error:", error);
            ctx.res.writeHead(500, { "Content-Type": "application/json" });
            ctx.res.end(JSON.stringify({ error: "Failed to get user info" }));
        }
        return [2 /*return*/];
    });
}); });
// Health check endpoints for deployment pipeline
router.get("/health", function (ctx) {
    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0",
    }));
});
router.get("/api/v1/health", function (ctx) {
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
router.get("/favicon.ico", function (ctx) {
    ctx.res.writeHead(204);
    ctx.res.end();
});
router.get("/favicon-16x16.png", function (ctx) {
    ctx.res.writeHead(204);
    ctx.res.end();
});
router.get("/favicon-32x32.png", function (ctx) {
    ctx.res.writeHead(204);
    ctx.res.end();
});
// HTTP server
var server = (0, http_1.createServer)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var url, ctx, handled;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                url = new URL((_a = req.url) !== null && _a !== void 0 ? _a : "/", "http://".concat(req.headers.host));
                ctx = { req: req, res: res, prisma: prisma, url: url, requestId: "" };
                return [4 /*yield*/, router.handle(ctx)];
            case 1:
                handled = _b.sent();
                if (!handled) {
                    res.writeHead(404, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Not found" }));
                }
                return [2 /*return*/];
        }
    });
}); });
// WebSocket setup
var wss = new ws_1.WebSocketServer({ server: server });
var wsManager = new manager_1.WebSocketManager(wss);
// Graceful shutdown
function shutdown(signal) {
    return __awaiter(this, void 0, void 0, function () {
        var e_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    logging_1.logger.info("[server] ".concat(signal, " received, shutting down gracefully"));
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.allSettled([connection_1.DatabaseManager.disconnect(), (_a = wsManager.shutdown) === null || _a === void 0 ? void 0 : _a.call(wsManager)])];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _b.sent();
                    logging_1.logger.error("[server] Error during shutdown", e_1);
                    return [3 /*break*/, 4];
                case 4:
                    // Close HTTP server
                    server.close(function () {
                        process.exit(0);
                    });
                    // Fallback exit after timeout
                    setTimeout(function () { return process.exit(0); }, 5000).unref();
                    return [2 /*return*/];
            }
        });
    });
}
process.on("SIGTERM", function () { return void shutdown("SIGTERM"); });
process.on("SIGINT", function () { return void shutdown("SIGINT"); });
// Start server
function startServer() {
    return __awaiter(this, void 0, void 0, function () {
        var error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, connection_1.DatabaseManager.connect()];
                case 1:
                    _a.sent();
                    server.listen(PORT, function () {
                        logging_1.logger.info("[Server] Listening on port", { port: PORT });
                        console.log("[server] Database: ".concat(connection_1.DatabaseManager.getConnectionStatus() ? "connected" : "disconnected"));
                    });
                    return [3 /*break*/, 3];
                case 2:
                    error_4 = _a.sent();
                    logging_1.logger.error("[server] Failed to start:", error_4);
                    process.exit(1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
startServer();
