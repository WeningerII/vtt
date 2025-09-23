/**
 * Token API Routes
 */
import { Router, Request, Response, NextFunction, type IRouter } from "express";
import { DatabaseManager } from "../database/connection";
import { getAuthManager, AuthUser } from "../auth/auth-manager";
import { TokenService } from "../services/TokenService";

const prisma = DatabaseManager.getInstance();
export const tokensRouter: IRouter = Router();

// Extended Request interface to include user
interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

// Middleware to verify authentication
const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const user = await getAuthManager().verifyAccessToken(token);
    if (!user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    (req as AuthenticatedRequest).user = user;
    next();
  } catch {
    res.status(500).json({ error: "Authentication failed" });
    return;
  }
};

// GET /tokens - List tokens for a scene
tokensRouter.get("/", async (req, res) => {
  try {
    const { sceneId, characterId, visibility, gameSessionId, limit = 100, offset = 0 } = req.query;

    if (!gameSessionId) {
      return res.status(400).json({ success: false, error: "Missing gameSessionId parameter" });
    }

    const tokenService = new TokenService(prisma);
    const result = await tokenService.searchTokens({
      sceneId: sceneId as string,
      gameSessionId: gameSessionId as string,
      characterId: characterId as string,
      visibility: visibility as "VISIBLE" | "HIDDEN" | "PARTIAL" | "REVEALED",
      limit: parseInt(limit as string) || 100,
      offset: parseInt(offset as string) || 0,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("List tokens error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch tokens" });
  }
});

// GET /tokens/:tokenId - Get token by ID
tokensRouter.get("/:tokenId", async (req, res) => {
  try {
    const { tokenId } = req.params;

    const token = await prisma.token.findUnique({
      where: { id: tokenId },
      include: {
        gameSession: true,
        encounterTokens: true,
      },
    });

    if (!token) {
      return res.status(404).json({ success: false, error: "Token not found" });
    }

    res.json({ success: true, data: token });
  } catch (error) {
    console.error("Get token error:", error);
    res.status(500).json({ success: false, error: "Failed to get token" });
  }
});

// POST /tokens - Create a new token
tokensRouter.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, sceneId, x, y, type, visibility, characterId, gameSessionId, ...rest } = req.body;

    if (!name || typeof x !== "number" || typeof y !== "number" || !gameSessionId) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields: name, gameSessionId, x, y" });
    }

    // Validate visibility enum if provided
    const validVisibilities = ["VISIBLE", "HIDDEN", "PARTIAL", "REVEALED"];
    if (visibility && !validVisibilities.includes(visibility)) {
      return res.status(400).json({
        success: false,
        error: "Invalid visibility. Must be VISIBLE, HIDDEN, PARTIAL, or REVEALED",
      });
    }

    // Validate type enum if provided
    const validTypes = ["PC", "NPC", "MONSTER", "OBJECT", "EFFECT"];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: "Invalid type. Must be PC, NPC, MONSTER, OBJECT, or EFFECT",
      });
    }

    // Validate characterId exists if provided (fixed from actorId)
    if (characterId) {
      const character = await prisma.character.findUnique({
        where: { id: characterId },
      });
      if (!character) {
        return res.status(400).json({ success: false, error: "Character not found" });
      }
    }

    // Validate that the game session exists
    const gameSession = await prisma.gameSession.findUnique({
      where: { id: gameSessionId },
    });
    if (!gameSession) {
      return res.status(400).json({ success: false, error: "Game session not found" });
    }

    const tokenService = new TokenService(prisma);
    const created = await tokenService.createToken({
      name,
      gameSessionId,
      sceneId,
      characterId,
      x,
      y,
      type: type || "OBJECT",
      visibility: visibility || "VISIBLE",
      ...rest,
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("Create token error:", error);
    res.status(500).json({ success: false, error: "Failed to create token" });
  }
});

// POST /tokens/from-character - Create token from character
tokensRouter.post(
  "/from-character",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { characterId, sceneId, x, y, gameSessionId, name, ...options } = req.body;

      if (
        !characterId ||
        !sceneId ||
        typeof x !== "number" ||
        typeof y !== "number" ||
        !gameSessionId
      ) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: characterId, sceneId, gameSessionId, x, y",
        });
      }

      // Validate character exists (fixed from querying token table)
      const character = await prisma.character.findUnique({
        where: { id: characterId },
      });

      if (!character) {
        return res.status(404).json({ success: false, error: "Character not found" });
      }

      // Validate that the game session exists
      const gameSession = await prisma.gameSession.findUnique({
        where: { id: gameSessionId },
      });
      if (!gameSession) {
        return res.status(400).json({ success: false, error: "Game session not found" });
      }

      const tokenService = new TokenService(prisma);
      const created = await tokenService.createTokenFromCharacter(
        characterId,
        gameSessionId,
        sceneId,
        x,
        y,
        { name, ...options },
      );

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      console.error("Create token from character error:", error);
      res.status(500).json({ success: false, error: "Failed to create token from character" });
    }
  },
);

// PUT /tokens/:tokenId/move - Move token to new position
tokensRouter.put(
  "/:tokenId/move",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tokenId } = req.params;
      const { x, y, rotation } = req.body;

      if (typeof x !== "number" || typeof y !== "number") {
        return res
          .status(400)
          .json({ success: false, error: "Missing or invalid x, y coordinates" });
      }

      const tokenService = new TokenService(prisma);
      const updated = await tokenService.moveToken(tokenId, x, y, rotation);

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("Move token error:", error);
      res.status(500).json({ success: false, error: "Failed to move token" });
    }
  },
);

// PUT /tokens/:tokenId - Update token
tokensRouter.put("/:tokenId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tokenId } = req.params;

    const tokenService = new TokenService(prisma);
    const updated = await tokenService.updateToken(tokenId, req.body);

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update token error:", error);
    res.status(500).json({ success: false, error: "Failed to update token" });
  }
});

// DELETE /tokens/:tokenId - Delete token
tokensRouter.delete("/:tokenId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tokenId } = req.params;

    const tokenService = new TokenService(prisma);
    await tokenService.deleteToken(tokenId);

    res.json({ success: true, data: { message: "Token deleted successfully" } });
  } catch (error) {
    console.error("Delete token error:", error);
    res.status(500).json({ success: false, error: "Failed to delete token" });
  }
});
