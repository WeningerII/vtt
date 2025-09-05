/**
 * Condition routes (CRUD + application management)
 */

import { RouteHandler } from "../router/types";

// GET /conditions - List all conditions
export const listConditionsHandler: RouteHandler = async (ctx) => {
  try {
    const type = ctx.url.searchParams.get("type");
    const limit = Math.min(parseInt(ctx.url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(ctx.url.searchParams.get("offset") || "0");

    const where = type ? { type: type as any } : Record<string, any>;

    const [items, total] = await Promise.all([
      ctx.prisma.condition.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { name: "asc" },
      }),
      ctx.prisma.condition.count({ where }),
    ]);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ items, total, limit, offset }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to list conditions" }));
  }
};

// GET /conditions/:conditionId - Get condition by ID
export const getConditionHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.conditionId || ctx.url.pathname.split("/")[2];
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing conditionId" }));
      return;
    }

    const condition = await ctx.prisma.condition.findUnique({
      where: { id },
      include: {
        appliedInstances: {
          include: {
            actor: true,
            token: true,
            encounterParticipant: {
              include: {
                actor: true,
              },
            },
          },
        },
      },
    });

    if (!condition) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Condition not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ condition }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to get condition" }));
  }
};

// POST /conditions - Create a new condition
export const createConditionHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);

    if (!body?.name || !body?.type || !body?.description) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing required fields: name, type, description" }));
      return;
    }

    // Validate type enum
    const validTypes = ["BUFF", "DEBUFF", "STATUS", "ENVIRONMENTAL"];
    if (!validTypes.includes(body.type)) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(
        JSON.stringify({ error: "Invalid type. Must be BUFF, DEBUFF, STATUS, or ENVIRONMENTAL" }),
      );
      return;
    }

    const conditionData = {
      name: body.name,
      type: body.type,
      description: body.description,
      rules: body.rules || null,
    };

    const created = await ctx.prisma.condition.create({
      data: conditionData,
    });

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, condition: created }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to create condition" }));
  }
};

// POST /conditions/:conditionId/apply - Apply condition to actor/token/participant
export const applyConditionHandler: RouteHandler = async (ctx) => {
  try {
    const conditionId = ctx.params?.conditionId || ctx.url.pathname.split("/")[2];
    if (!conditionId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing conditionId" }));
      return;
    }

    const body = await parseJsonBody(ctx.req);

    // Validate that exactly one target is specified
    const targets = [body.actorId, body.tokenId, body.encounterParticipantId].filter(Boolean);
    if (targets.length !== 1) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(
        JSON.stringify({
          error: "Must specify exactly one of: actorId, tokenId, encounterParticipantId",
        }),
      );
      return;
    }

    // Validate condition exists
    const condition = await ctx.prisma.condition.findUnique({
      where: { id: conditionId },
    });
    if (!condition) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Condition not found" }));
      return;
    }

    // Validate target exists
    if (body.actorId) {
      const actor = await ctx.prisma.actor.findUnique({ where: { id: body.actorId } });
      if (!actor) {
        ctx.res.writeHead(400, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify({ error: "Actor not found" }));
        return;
      }
    } else if (body.tokenId) {
      const token = await ctx.prisma.token.findUnique({ where: { id: body.tokenId } });
      if (!token) {
        ctx.res.writeHead(400, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify({ error: "Token not found" }));
        return;
      }
    } else if (body.encounterParticipantId) {
      const participant = await ctx.prisma.encounterParticipant.findUnique({
        where: { id: body.encounterParticipantId },
      });
      if (!participant) {
        ctx.res.writeHead(400, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify({ error: "Encounter participant not found" }));
        return;
      }
    }

    const appliedData: any = {
      conditionId,
      severity: body.severity || 1,
      duration: body.duration || null,
      source: body.source || null,
      notes: body.notes || null,
      isActive: true,
    };

    if (body.actorId) {appliedData.actorId = body.actorId;}
    if (body.tokenId) {appliedData.tokenId = body.tokenId;}
    if (body.encounterParticipantId)
      {appliedData.encounterParticipantId = body.encounterParticipantId;}

    const applied = await ctx.prisma.appliedCondition.create({
      data: appliedData,
      include: {
        condition: true,
        actor: true,
        token: true,
        encounterParticipant: {
          include: {
            actor: true,
          },
        },
      },
    });

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, appliedCondition: applied }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to apply condition" }));
  }
};

// GET /applied-conditions - List applied conditions with filters
export const listAppliedConditionsHandler: RouteHandler = async (ctx) => {
  try {
    const actorId = ctx.url.searchParams.get("actorId");
    const tokenId = ctx.url.searchParams.get("tokenId");
    const encounterParticipantId = ctx.url.searchParams.get("encounterParticipantId");
    const isActive = ctx.url.searchParams.get("isActive");
    const limit = Math.min(parseInt(ctx.url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(ctx.url.searchParams.get("offset") || "0");

    const where: any = {};
    if (actorId) {where.actorId = actorId;}
    if (tokenId) {where.tokenId = tokenId;}
    if (encounterParticipantId) {where.encounterParticipantId = encounterParticipantId;}
    if (isActive !== null) {where.isActive = isActive === "true";}

    const [items, total] = await Promise.all([
      ctx.prisma.appliedCondition.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          condition: true,
          actor: true,
          token: true,
          encounterParticipant: {
            include: {
              actor: true,
            },
          },
        },
      }),
      ctx.prisma.appliedCondition.count({ where }),
    ]);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ items, total, limit, offset }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to list applied conditions" }));
  }
};

// PUT /applied-conditions/:appliedConditionId - Update applied condition
export const updateAppliedConditionHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.appliedConditionId || ctx.url.pathname.split("/")[2];
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing appliedConditionId" }));
      return;
    }

    const body = await parseJsonBody(ctx.req);
    const data: any = {};

    // Only update provided fields
    if (typeof body.severity === "number") {data.severity = body.severity;}
    if (typeof body.duration === "number") {data.duration = body.duration;}
    if (typeof body.source === "string") {data.source = body.source;}
    if (typeof body.notes === "string") {data.notes = body.notes;}
    if (typeof body.isActive === "boolean") {data.isActive = body.isActive;}

    const updated = await ctx.prisma.appliedCondition.update({
      where: { id },
      data,
      include: {
        condition: true,
        actor: true,
        token: true,
        encounterParticipant: {
          include: {
            actor: true,
          },
        },
      },
    });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, appliedCondition: updated }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to update applied condition" }));
  }
};

// DELETE /applied-conditions/:appliedConditionId - Remove applied condition
export const removeAppliedConditionHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.appliedConditionId || ctx.url.pathname.split("/")[2];
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing appliedConditionId" }));
      return;
    }

    await ctx.prisma.appliedCondition.delete({ where: { id } });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: error.message || "Failed to remove applied condition" }));
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
