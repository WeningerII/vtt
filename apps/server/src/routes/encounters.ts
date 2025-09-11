/**
 * Encounter routes (CRUD + combat flow)
 */

import { RouteHandler } from "../router/types";
import { requireAuth, getAuthenticatedUserId } from "../middleware/auth";
import { parseJsonBody } from "../utils/json";

// GET /encounters - List encounters for a campaign
export const listEncountersHandler: RouteHandler = async (ctx) => {
  try {
    // Require authentication
    const userId = getAuthenticatedUserId(ctx);
    
    const gameSessionId = ctx.url.searchParams.get("gameSessionId");
    const limit = Math.min(parseInt(ctx.url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(ctx.url.searchParams.get("offset") || "0");

    if (!gameSessionId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing gameSessionId parameter" }));
      return;
    }

    // Verify user has access to this game session by checking if they have PC tokens
    const userTokenCount = await ctx.prisma.token.count({
      where: {
        gameSessionId,
        type: 'PC'
      }
    });

    if (userTokenCount === 0) {
      ctx.res.writeHead(403, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Access denied to this game session" }));
      return;
    }

    const where = { gameSessionId };

    const [items, total] = await Promise.all([
      ctx.prisma.encounter.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          encounterTokens: {
            include: {
              token: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  initiative: true,
                  health: true,
                  maxHealth: true
                }
              },
            },
            orderBy: { initiative: "desc" },
          },
        },
      }),
      ctx.prisma.encounter.count({ where }),
    ]);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ items, total, limit, offset }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to list encounters" }));
  }
};

// GET /encounters/:id - Get encounter by ID
export const getEncounterHandler: RouteHandler = async (ctx) => {
  try {
    // Require authentication
    const userId = getAuthenticatedUserId(ctx);
    
    const id = ctx.params?.id;
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing encounter ID" }));
      return;
    }

    const encounter = await ctx.prisma.encounter.findUnique({
      where: { id },
      include: {
        encounterTokens: {
          include: {
            token: {
              select: {
                id: true,
                name: true,
                type: true,
                initiative: true,
                health: true,
                maxHealth: true,
                x: true,
                y: true
              }
            },
          },
          orderBy: { initiative: "desc" },
        },
        gameSession: {
          select: {
            id: true,
            name: true,
            campaignId: true
          }
        }
      },
    });

    if (!encounter) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter not found" }));
      return;
    }

    // Verify user has access to this game session
    const userTokenCount = await ctx.prisma.token.count({
      where: {
        gameSessionId: encounter.gameSession.id,
        type: 'PC'
      }
    });

    if (userTokenCount === 0) {
      ctx.res.writeHead(403, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Access denied to this encounter" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ encounter }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to get encounter" }));
  }
};

// POST /encounters - Create new encounter
export const createEncounterHandler: RouteHandler = async (ctx) => {
  try {
    // Require authentication
    const userId = getAuthenticatedUserId(ctx);
    
    const body = await parseRequestBody(ctx.req);
    const { name, gameSessionId, description } = body;

    if (!name || !gameSessionId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing required fields: name, gameSessionId" }));
      return;
    }

    // Verify user has tokens in this game session
    const userTokenCount = await ctx.prisma.token.count({
      where: {
        gameSessionId,
        type: 'PC'
      }
    });

    if (userTokenCount === 0) {
      ctx.res.writeHead(403, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Access denied to create encounters in this session" }));
      return;
    }

    const encounter = await ctx.prisma.encounter.create({
      data: {
        name,
        gameSessionId,
        roundNumber: 1,
        currentTurn: 0,
        status: 'PLANNED',
      },
      include: {
        encounterTokens: {
          include: {
            token: true,
          },
          orderBy: { initiative: "desc" },
        },
      },
    });

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, encounter }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to create encounter" }));
  }
};

// POST /encounters/:id/participants - Add participant to encounter
export const addParticipantHandler: RouteHandler = async (ctx) => {
  try {
    // Require authentication
    const userId = getAuthenticatedUserId(ctx);
    
    const encounterId = ctx.params?.id;
    if (!encounterId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing encounter ID" }));
      return;
    }

    const body = await parseRequestBody(ctx.req);
    const { tokenId, initiative } = body;

    if (!tokenId || initiative === undefined) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing required fields: tokenId, initiative" }));
      return;
    }

    // Verify user has access to this encounter and the token
    const [encounter, token, userTokenCount] = await Promise.all([
      ctx.prisma.encounter.findUnique({
        where: { id: encounterId },
        include: {
          gameSession: {
            select: {
              id: true,
              name: true,
              campaignId: true
            }
          }
        }
      }),
      ctx.prisma.token.findUnique({
        where: { id: tokenId },
        select: { id: true, type: true, metadata: true }
      }),
      ctx.prisma.token.count({
        where: {
          gameSessionId: { in: [] }, // Will be updated below
          type: 'PC'
        }
      })
    ]);

    if (!encounter || !token) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter or token not found" }));
      return;
    }

    // Now check access with the correct gameSessionId
    const accessCount = await ctx.prisma.token.count({
      where: {
        gameSessionId: encounter.gameSessionId,
        type: 'PC'
      }
    });

    if (accessCount === 0) {
      ctx.res.writeHead(403, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Access denied" }));
      return;
    }

    // Check if token already participating
    const existing = await ctx.prisma.encounterToken.findFirst({
      where: {
        encounterId,
        tokenId,
      },
    });

    if (existing) {
      ctx.res.writeHead(409, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Token already participating in this encounter" }));
      return;
    }

    const participant = await ctx.prisma.encounterToken.create({
      data: {
        encounterId,
        tokenId,
        initiative,
      },
      include: {
        token: true,
      },
    });

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, participant }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to add participant" }));
  }
};

// PUT /encounters/:id - Update encounter
export const updateEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.id;
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing encounter ID" }));
      return;
    }

    const body = await parseRequestBody(ctx.req);
    const { name, status, roundNumber, currentTurn } = body;

    const data: any = {};
    if (name !== undefined) {data.name = name;}
    if (status !== undefined) {data.status = status;}
    if (roundNumber !== undefined) {data.roundNumber = roundNumber;}
    if (currentTurn !== undefined) {data.currentTurn = currentTurn;}

    const encounter = await ctx.prisma.encounter.update({
      where: { id },
      data,
      include: {
        encounterTokens: {
          include: {
            token: true,
          },
          orderBy: { initiative: "desc" },
        },
      },
    });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, encounter }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to update encounter" }));
  }
};

// Helper: parse JSON
async function parseRequestBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: any) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}
