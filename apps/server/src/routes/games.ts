/**
 * Game session management routes
 */

import { RouteHandler } from "../router/types";
import { GameManager } from "../game/GameManager";
import { GameConfig } from "../game/GameSession";

// Global game manager instance
const gameManager = new GameManager();

/**
 * POST /games - Create a new game session
 */
export const createGameHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);

    if (!body.gameId || typeof body.gameId !== "string") {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Invalid gameId" }));
      return;
    }

    const config: GameConfig = {
      gameId: body.gameId,
      mapId: body.mapId,
      maxPlayers: body.maxPlayers || 8,
      tickRate: body.tickRate || 15,
    };

    const game = gameManager.createGame(config);

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        game: game.getGameState(),
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(error.message.includes("already exists") ? 409 : 500, {
      "Content-Type": "application/json",
    });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to create game",
      }),
    );
  }
};

/**
 * GET /games/:gameId - Get game session info
 */
export const getGameHandler: RouteHandler = async (ctx) => {
  const gameId = ctx.url.pathname.split("/")[2];

  if (!gameId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing gameId" }));
    return;
  }

  const game = gameManager.getGame(gameId);

  if (!game) {
    ctx.res.writeHead(404, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Game not found" }));
    return;
  }

  ctx.res.writeHead(200, { "Content-Type": "application/json" });
  ctx.res.end(
    JSON.stringify({
      game: game.getGameState(),
      players: game.getPlayers(),
      connectedPlayers: game.getConnectedPlayerCount(),
    }),
  );
};

/**
 * POST /games/:gameId/join - Join a game session
 */
export const joinGameHandler: RouteHandler = async (ctx) => {
  const gameId = ctx.url.pathname.split("/")[2];

  if (!gameId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing gameId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);

    if (!body.userId || !body.displayName) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing userId or displayName" }));
      return;
    }

    const game = gameManager.findOrCreateGame(gameId);
    const success = game.addPlayer(body.userId, body.displayName);

    if (!success) {
      ctx.res.writeHead(409, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Player already in game" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        game: game.getGameState(),
        player: game.getPlayer(body.userId),
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to join game",
      }),
    );
  }
};

/**
 * POST /games/:gameId/leave - Leave a game session
 */
export const leaveGameHandler: RouteHandler = async (ctx) => {
  const gameId = ctx.url.pathname.split("/")[2];

  if (!gameId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing gameId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);

    if (!body.userId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing userId" }));
      return;
    }

    const game = gameManager.getGame(gameId);

    if (!game) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Game not found" }));
      return;
    }

    game.removePlayer(body.userId);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to leave game",
      }),
    );
  }
};

/**
 * GET /games - List all active games
 */
export const listGamesHandler: RouteHandler = async (ctx) => {
  const games = gameManager.getActiveGames();
  const stats = gameManager.getStats();

  ctx.res.writeHead(200, { "Content-Type": "application/json" });
  ctx.res.end(
    JSON.stringify({
      games: games.map((game) => ({
        ...game.getGameState(),
        playerCount: game.getPlayerCount(),
        connectedPlayers: game.getConnectedPlayerCount(),
      })),
      stats,
    }),
  );
};

/**
 * POST /games/:gameId/tokens - Create a new token
 */
export const createTokenHandler: RouteHandler = async (ctx) => {
  const gameId = ctx.url.pathname.split("/")[2];

  if (!gameId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing gameId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);

    if (typeof body.x !== "number" || typeof body.y !== "number") {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing or invalid x, y coordinates" }));
      return;
    }

    const game = gameManager.getGame(gameId);

    if (!game) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Game not found" }));
      return;
    }

    const tokenId = game.createToken(body.x, body.y, body.ownerId);

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        tokenId: tokenId.toString(),
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to create token",
      }),
    );
  }
};

/**
 * POST /games/:gameId/tokens/:tokenId/move - Move a token
 */
export const moveTokenHandler: RouteHandler = async (ctx) => {
  const pathParts = ctx.url.pathname.split("/");
  const gameId = pathParts[2];
  const tokenId = pathParts[4];

  if (!gameId || !tokenId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing gameId or tokenId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);

    if (typeof body.x !== "number" || typeof body.y !== "number") {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing or invalid x, y coordinates" }));
      return;
    }

    const game = gameManager.getGame(gameId);

    if (!game) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Game not found" }));
      return;
    }

    const success = game.moveToken(parseInt(tokenId), body.x, body.y, body.animate !== false);

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Token not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to move token",
      }),
    );
  }
};

/**
 * POST /games/:gameId/dice - Roll dice
 */
export const rollDiceHandler: RouteHandler = async (ctx) => {
  const gameId = ctx.url.pathname.split("/")[2];

  if (!gameId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Missing gameId" }));
    return;
  }

  try {
    const body = await parseJsonBody(ctx.req);

    if (!body.dice || !body.userId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing dice or userId" }));
      return;
    }

    const game = gameManager.getGame(gameId);

    if (!game) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Game not found" }));
      return;
    }

    const result = game.rollDice(body.dice, body.userId, body.label);

    if (!result) {
      ctx.res.writeHead(403, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Player not found in game" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        result,
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to roll dice",
      }),
    );
  }
};

// Helper function to parse JSON from request body
async function parseJsonBody(req: any): Promise<any> {
  return new Promise((_resolve, __reject) => {
    let body = "";

    req.on("data", (_chunk: any) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (_error) {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

// Export game manager for use in WebSocket handlers
export { gameManager };
