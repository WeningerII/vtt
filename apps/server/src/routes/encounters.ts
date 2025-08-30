/**
 * Encounter routes (CRUD + combat flow)
 */

import { RouteHandler } from "../router/types";

// GET /encounters - List encounters for a campaign
export const listEncountersHandler: RouteHandler = async (ctx) => {
  try {
    const campaignId = ctx.url.searchParams.get("campaignId");
    const limit = Math.min(parseInt(ctx.url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(ctx.url.searchParams.get("offset") || "0");

    if (!campaignId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing campaignId parameter" }));
      return;
    }

    const where = { campaignId };

    const [items, total] = await Promise.all([
      ctx.prisma.encounter.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          participants: {
            include: {
              actor: {
                include: {
                  monster: true,
                  character: true,
                },
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

// GET /encounters/:encounterId - Get encounter by ID
export const getEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.encounterId || ctx.url.pathname.split("/")[2];
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing encounterId" }));
      return;
    }

    const encounter = await ctx.prisma.encounter.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            actor: {
              include: {
                monster: true,
                character: true,
                appliedConditions: {
                  include: {
                    condition: true,
                  },
                },
              },
            },
            appliedConditions: {
              include: {
                condition: true,
              },
            },
          },
          orderBy: { initiative: "desc" },
        },
      },
    });

    if (!encounter) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ encounter }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to get encounter" }));
  }
};

// POST /encounters - Create a new encounter
export const createEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);

    if (!body?.name || !body?.campaignId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing required fields: name, campaignId" }));
      return;
    }

    const encounterData = {
      name: body.name,
      campaignId: body.campaignId,
      description: body.description || "",
      currentRound: 0,
      currentTurn: 0,
      isActive: false,
    };

    const created = await ctx.prisma.encounter.create({
      data: encounterData,
      include: {
        participants: {
          include: {
            actor: {
              include: {
                monster: true,
                character: true,
              },
            },
          },
          orderBy: { initiative: "desc" },
        },
      },
    });

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, encounter: created }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to create encounter" }));
  }
};

// POST /encounters/:encounterId/participants - Add actor to encounter
export const addParticipantHandler: RouteHandler = async (ctx) => {
  try {
    const encounterId = ctx.params?.encounterId || ctx.url.pathname.split("/")[2];
    if (!encounterId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing encounterId" }));
      return;
    }

    const body = await parseJsonBody(ctx.req);

    if (!body?.actorId || typeof body.initiative !== "number") {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing required fields: actorId, initiative" }));
      return;
    }

    // Validate encounter exists
    const encounter = await ctx.prisma.encounter.findUnique({
      where: { id: encounterId },
    });
    if (!encounter) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter not found" }));
      return;
    }

    // Validate actor exists
    const actor = await ctx.prisma.actor.findUnique({
      where: { id: body.actorId },
    });
    if (!actor) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Actor not found" }));
      return;
    }

    // Check if participant already exists
    const existing = await ctx.prisma.encounterParticipant.findUnique({
      where: {
        encounterId_actorId: {
          encounterId,
          actorId: body.actorId,
        },
      },
    });

    if (existing) {
      ctx.res.writeHead(409, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Actor already in encounter" }));
      return;
    }

    const participant = await ctx.prisma.encounterParticipant.create({
      data: {
        encounterId,
        actorId: body.actorId,
        initiative: body.initiative,
        isActive: true,
        hasActed: false,
      },
      include: {
        actor: {
          include: {
            monster: true,
            character: true,
          },
        },
      },
    });

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, participant }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to add participant" }));
  }
};

// POST /encounters/:encounterId/start - Start encounter
export const startEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.encounterId || ctx.url.pathname.split("/")[2];
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing encounterId" }));
      return;
    }

    // Check if encounter has participants
    const participantCount = await ctx.prisma.encounterParticipant.count({
      where: { encounterId: id },
    });

    if (participantCount === 0) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Cannot start encounter without participants" }));
      return;
    }

    const updated = await ctx.prisma.encounter.update({
      where: { id },
      data: {
        isActive: true,
        currentRound: 1,
        currentTurn: 0,
      },
      include: {
        participants: {
          include: {
            actor: {
              include: {
                monster: true,
                character: true,
              },
            },
          },
          orderBy: { initiative: "desc" },
        },
      },
    });

    // Reset all participants' hasActed flag
    await ctx.prisma.encounterParticipant.updateMany({
      where: { encounterId: id },
      data: { hasActed: false },
    });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, encounter: updated }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to start encounter" }));
  }
};

// POST /encounters/:encounterId/next-turn - Advance to next turn
export const nextTurnHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.encounterId || ctx.url.pathname.split("/")[2];
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing encounterId" }));
      return;
    }

    const encounter = await ctx.prisma.encounter.findUnique({
      where: { id },
      include: {
        participants: {
          where: { isActive: true },
          orderBy: { initiative: "desc" },
        },
      },
    });

    if (!encounter) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter not found" }));
      return;
    }

    if (!encounter.isActive) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Encounter is not active" }));
      return;
    }

    const participants = encounter.participants;
    if (participants.length === 0) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "No active participants" }));
      return;
    }

    let newTurn = encounter.currentTurn + 1;
    let newRound = encounter.currentRound;

    // If we've gone through all participants, start new round
    if (newTurn >= participants.length) {
      newTurn = 0;
      newRound += 1;

      // Reset hasActed for all participants at start of new round
      await ctx.prisma.encounterParticipant.updateMany({
        where: { encounterId: id },
        data: { hasActed: false },
      });
    }

    const updated = await ctx.prisma.encounter.update({
      where: { id },
      data: {
        currentTurn: newTurn,
        currentRound: newRound,
      },
      include: {
        participants: {
          include: {
            actor: {
              include: {
                monster: true,
                character: true,
              },
            },
          },
          orderBy: { initiative: "desc" },
        },
      },
    });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        encounter: updated,
        currentParticipant: participants[newTurn] || null,
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to advance turn" }));
  }
};

// POST /encounters/:encounterId/end - End encounter
export const endEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.encounterId || ctx.url.pathname.split("/")[2];
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing encounterId" }));
      return;
    }

    const updated = await ctx.prisma.encounter.update({
      where: { id },
      data: {
        isActive: false,
      },
      include: {
        participants: {
          include: {
            actor: {
              include: {
                monster: true,
                character: true,
              },
            },
          },
          orderBy: { initiative: "desc" },
        },
      },
    });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, encounter: updated }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to end encounter" }));
  }
};

// DELETE /encounters/:encounterId - Delete encounter
export const deleteEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.encounterId || ctx.url.pathname.split("/")[2];
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing encounterId" }));
      return;
    }

    await ctx.prisma.encounter.delete({ where: { id } });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to delete encounter" }));
  }
};

// Helper: parse JSON
async function parseJsonBody(req: any): Promise<any> {
  return new Promise((_resolve, __reject) => {
    let body = "";
    req.on("data", (_chunk: any) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : Record<string, any>);
      } catch (_err) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}
