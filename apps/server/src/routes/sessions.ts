/**
import { getErrorMessage } from "../utils/errors";
 * Game Session API Routes
 */
import { Router, Request, Response, NextFunction } from "express";
import { DatabaseManager } from "../database/connection";
import { getAuthManager, AuthUser } from "../auth/auth-manager";
import type { Prisma } from "@prisma/client";

const prisma = DatabaseManager.getInstance();
export const sessionsRouter = Router();

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
  } catch (error) {
    res.status(401).json({ error: "Authentication failed" });
  }
};

function toJsonObject(value: Prisma.JsonValue | null): Prisma.JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Prisma.JsonObject;
}

function readString(obj: Prisma.JsonObject, key: string): string | undefined {
  const value = obj[key];
  return typeof value === "string" ? value : undefined;
}

function readNumber(obj: Prisma.JsonObject, key: string): number | undefined {
  const value = obj[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(obj: Prisma.JsonObject, key: string): boolean | undefined {
  const value = obj[key];
  return typeof value === "boolean" ? value : undefined;
}

// Get all sessions
sessionsRouter.get("/", async (req, res) => {
  try {
    const sessions = await prisma.gameSession.findMany({
      include: {
        tokens: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedSessions = sessions.map((session) => {
      const metadata = toJsonObject(session.metadata);
      const description =
        readString(metadata, "description") || `Campaign session - ${session.status}`;
      const gamemasterId = readString(metadata, "gamemasterId") || "unknown";
      const maxPlayers = readNumber(metadata, "maxPlayers") ?? 4;
      const system = readString(metadata, "system") || "D&D 5e";
      const isPrivate = readBoolean(metadata, "isPrivate") ?? false;
      const allowSpectators = readBoolean(metadata, "allowSpectators");

      return {
        id: session.id,
        name: session.name,
        description,
        gamemaster: {
          id: gamemasterId,
          username: "gamemaster",
          displayName: "Game Master",
        },
        players: [], // Will be populated from WebSocket connections
        maxPlayers,
        system,
        status: session.status.toLowerCase(),
        settings: {
          maxPlayers,
          isPrivate,
          allowSpectators: allowSpectators ?? true,
        },
        createdAt: session.createdAt.toISOString(),
        lastActivity: session.updatedAt.toISOString(),
      };
    });

    res.json({
      success: true,
      data: formattedSessions,
    });
  } catch (error) {
    console.error("Get sessions error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch sessions" });
  }
});

// Get specific session
sessionsRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma.gameSession.findUnique({
      where: { id },
      include: {
        tokens: true,
      },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }

    const metadata = toJsonObject(session.metadata);
    const description =
      readString(metadata, "description") || `Campaign session - ${session.status}`;
    const gamemasterId = readString(metadata, "gamemasterId") || "unknown";
    const maxPlayers = readNumber(metadata, "maxPlayers") ?? 4;
    const system = readString(metadata, "system") || "D&D 5e";
    const isPrivate = readBoolean(metadata, "isPrivate") ?? false;
    const allowSpectators = readBoolean(metadata, "allowSpectators");

    const formattedSession = {
      id: session.id,
      name: session.name,
      description,
      gamemaster: {
        id: gamemasterId,
        username: "gamemaster",
        displayName: "Game Master",
      },
      players: [],
      maxPlayers,
      system,
      status: session.status.toLowerCase(),
      settings: {
        maxPlayers,
        isPrivate,
        allowSpectators: allowSpectators ?? true,
      },
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.updatedAt.toISOString(),
      tokens: session.tokens,
    };

    res.json({
      success: true,
      data: formattedSession,
    });
  } catch (error) {
    console.error("Get session error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch session" });
  }
});

// Create new session
sessionsRouter.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, campaignId, maxPlayers, isPrivate, allowSpectators, system } =
      req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: "Session name is required" });
    }

    // Validate campaign exists and user has access
    let actualCampaignId = campaignId;
    if (campaignId) {
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: campaignId,
          members: {
            some: {
              userId: req.user.id,
              status: "active",
              role: { in: ["gamemaster", "co-gamemaster"] },
            },
          },
        },
      });

      if (!campaign) {
        return res
          .status(403)
          .json({ success: false, error: "Campaign not found or insufficient permissions" });
      }
    } else {
      // Create a new campaign for this session if none provided
      const newCampaign = await prisma.campaign.create({
        data: {
          name: `${name} Campaign`,
          members: {
            create: {
              userId: req.user.id,
              role: "gamemaster",
              status: "active",
            },
          },
          settings: {
            create: {
              isPublic: !isPrivate,
              allowSpectators: allowSpectators !== false,
              maxPlayers: maxPlayers || 4,
            },
          },
        },
      });
      actualCampaignId = newCampaign.id;
    }

    const session = await prisma.gameSession.create({
      data: {
        name,
        campaignId: actualCampaignId,
        status: "WAITING",
        metadata: {
          description: description || "",
          maxPlayers: maxPlayers || 4,
          isPrivate: isPrivate || false,
          allowSpectators: allowSpectators !== false,
          system: system || "D&D 5e",
          gamemasterId: req.user.id,
        },
      },
    });

    const formattedSession = {
      id: session.id,
      name: session.name,
      description: description || `Campaign session - ${session.status}`,
      gamemaster: {
        id: req.user.id,
        username: req.user.username,
        displayName: req.user.displayName,
      },
      players: [],
      maxPlayers: maxPlayers || 4,
      system: system || "D&D 5e",
      status: session.status.toLowerCase(),
      settings: {
        maxPlayers: maxPlayers || 4,
        isPrivate: isPrivate || false,
        allowSpectators: allowSpectators !== false,
      },
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.updatedAt.toISOString(),
    };

    res.status(201).json({
      success: true,
      data: formattedSession,
    });
  } catch (error) {
    console.error("Create session error:", error);
    res.status(500).json({ success: false, error: "Failed to create session" });
  }
});

// Join session
sessionsRouter.post("/:id/join", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find session with campaign information
    const session = await prisma.gameSession.findUnique({
      where: { id },
      include: {
        tokens: true,
      },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }

    if (session.status !== "WAITING" && session.status !== "ACTIVE") {
      return res.status(400).json({ success: false, error: "Cannot join this session" });
    }

    // Check if user is a member of the campaign
    const campaignMember = await prisma.campaignMember.findUnique({
      where: {
        userId_campaignId: {
          userId,
          campaignId: session.campaignId,
        },
      },
    });

    if (!campaignMember) {
      return res
        .status(403)
        .json({ success: false, error: "You are not a member of this campaign" });
    }

    if (campaignMember.status !== "active") {
      return res
        .status(403)
        .json({ success: false, error: "Your campaign membership is not active" });
    }

    // Check session settings for max players
    const metadata = toJsonObject(session.metadata);
    const maxPlayers = readNumber(metadata, "maxPlayers") ?? 4;

    // Count current active tokens (representing players in session)
    const activePlayerTokens = session.tokens.filter(
      (token) => token.type === "PC" && token.visibility === "VISIBLE",
    ).length;

    if (
      activePlayerTokens >= maxPlayers &&
      campaignMember.role !== "gamemaster" &&
      campaignMember.role !== "co-gamemaster"
    ) {
      return res.status(400).json({ success: false, error: "Session is full" });
    }

    // Update session to set as ACTIVE if it was WAITING
    if (session.status === "WAITING") {
      await prisma.gameSession.update({
        where: { id },
        data: {
          status: "ACTIVE",
          startedAt: new Date(),
        },
      });
    }

    res.json({
      success: true,
      data: {
        message: "Successfully joined session",
        sessionId: id,
        campaignId: session.campaignId,
        role: campaignMember.role,
        websocketUrl: "/ws",
        sessionStatus: session.status === "WAITING" ? "ACTIVE" : session.status,
      },
    });
  } catch (error) {
    console.error("Join session error:", error);
    res.status(500).json({ success: false, error: "Failed to join session" });
  }
});

// Delete session (GM only)
sessionsRouter.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const session = await prisma.gameSession.findUnique({
      where: { id },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }

    // Check if user is a GM of the campaign (more robust than metadata check)
    const campaignMember = await prisma.campaignMember.findUnique({
      where: {
        userId_campaignId: {
          userId,
          campaignId: session.campaignId,
        },
      },
    });

    if (
      !campaignMember ||
      (campaignMember.role !== "gamemaster" && campaignMember.role !== "co-gamemaster")
    ) {
      return res
        .status(403)
        .json({ success: false, error: "Only game masters can delete this session" });
    }

    // Delete the session (this will cascade delete tokens due to onDelete: Cascade in schema)
    await prisma.gameSession.delete({
      where: { id },
    });

    res.json({ success: true, data: { message: "Session deleted successfully" } });
  } catch (error) {
    console.error("Delete session error:", error);
    res.status(500).json({ success: false, error: "Failed to delete session" });
  }
});
