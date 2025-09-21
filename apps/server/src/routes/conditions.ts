/**
 * Condition routes (CRUD + application management)
 */

import { RouteHandler } from "../router/types";
import { getErrorMessage } from "../utils/errors";
import {
  ConditionService,
  ConditionType,
  type CreateConditionRequest,
  type UpdateConditionRequest,
  type ApplyConditionRequest,
} from "../services/ConditionService";
import { parseJsonBody } from "../utils/json";

type CreateConditionBody = Partial<CreateConditionRequest>;

interface ApplyConditionBody extends Partial<ApplyConditionRequest> {
  targetId?: string;
  targetType?: string;
}

interface UpdateAppliedConditionBody {
  duration?: number;
  metadata?: unknown;
  isActive?: boolean;
  expiresAt?: string | null;
}

type UpdateConditionBody = UpdateConditionRequest;
import { PrismaClient } from "@prisma/client";

// Lazy-load services to avoid initialization issues during module loading
let prisma: PrismaClient | null = null;
let conditionService: ConditionService | null = null;

function getServices() {
  if (!prisma) {
    prisma = new PrismaClient();
    conditionService = new ConditionService(prisma);
  }
  return { prisma, conditionService: conditionService! };
}

function getConditionService(): ConditionService {
  const { conditionService } = getServices();
  if (!conditionService) {
    throw new Error("ConditionService not initialized");
  }
  return conditionService;
}

/**
 * Validates and converts a string to ConditionType enum
 * @param type - The string to validate
 * @returns ConditionType if valid, undefined if null/empty, throws error if invalid
 */
function validateConditionType(type: string | null): ConditionType | undefined {
  if (!type) {
    return undefined;
  }

  const validTypes: ConditionType[] = ["BUFF", "DEBUFF", "NEUTRAL"];
  if (validTypes.includes(type as ConditionType)) {
    return type as ConditionType;
  }

  throw new Error(`Invalid condition type: ${type}. Must be one of: ${validTypes.join(", ")}`);
}

// GET /conditions - List all conditions
export const listConditionsHandler: RouteHandler = async (ctx) => {
  try {
    const typeParam = ctx.url.searchParams.get("type");
    const validatedType = validateConditionType(typeParam);
    const limit = Math.min(parseInt(ctx.url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(ctx.url.searchParams.get("offset") || "0");

    const result = await getConditionService().searchConditions({
      type: validatedType,
      limit,
      offset,
    });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify(result));
  } catch (error) {
    // Check if it's a validation error (invalid condition type)
    const errorMessage = getErrorMessage(error) || "Failed to list conditions";
    if (errorMessage.includes("Invalid condition type")) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: errorMessage }));
    } else {
      ctx.res.writeHead(500, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: errorMessage }));
    }
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

    const condition = await getConditionService().getCondition(id);

    if (!condition) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Condition not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ condition }));
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to get condition" }));
  }
};

// POST /conditions - Create a new condition
export const createConditionHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody<CreateConditionBody>(ctx.req);

    if (!body?.name || !body?.type) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing required fields: name, type" }));
      return;
    }

    // Validate type enum
    const validTypes = ["BUFF", "DEBUFF", "NEUTRAL"];
    if (!validTypes.includes(body.type)) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Invalid type. Must be BUFF, DEBUFF, or NEUTRAL" }));
      return;
    }

    const created = await getConditionService().createCondition({
      name: body.name,
      type: body.type as ConditionType,
      description: body.description,
      duration: body.duration,
      metadata: body.metadata,
    });

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, condition: created }));
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to create condition" }));
  }
};

// POST /conditions/:conditionId/apply - Apply condition to target
export const applyConditionHandler: RouteHandler = async (ctx) => {
  try {
    const conditionId = ctx.params?.conditionId || ctx.url.pathname.split("/")[2];
    if (!conditionId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing conditionId" }));
      return;
    }

    const body = await parseJsonBody<ApplyConditionBody>(ctx.req);

    if (!body.targetId || !body.targetType) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Must specify targetId and targetType" }));
      return;
    }

    // Validate target type
    const validTargetTypes = ["token", "character", "encounterParticipant", "actor"];
    if (!validTargetTypes.includes(body.targetType)) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(
        JSON.stringify({
          error: `Invalid targetType. Must be one of: ${validTargetTypes.join(", ")}`,
        }),
      );
      return;
    }

    const applyRequest: ApplyConditionRequest = {
      conditionId,
      duration: body.duration,
      metadata: body.metadata,
      appliedBy: body.appliedBy,
    };

    const applied = await getConditionService().applyCondition(
      body.targetId,
      body.targetType,
      applyRequest,
    );

    ctx.res.writeHead(201, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, appliedCondition: applied }));
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to apply condition" }));
  }
};

// GET /applied-conditions - List applied conditions with filters
export const listAppliedConditionsHandler: RouteHandler = async (ctx) => {
  try {
    const targetId = ctx.url.searchParams.get("targetId");
    const targetType = ctx.url.searchParams.get("targetType");

    if (!targetId) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "targetId is required" }));
      return;
    }

    const conditions = await getConditionService().getAppliedConditions(
      targetId,
      targetType || undefined,
    );

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ items: conditions, total: conditions.length }));
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({ error: getErrorMessage(error) || "Failed to list applied conditions" }),
    );
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

    const body = await parseJsonBody<UpdateAppliedConditionBody>(ctx.req);
    const data: Record<string, unknown> = {};

    // Only update provided fields
    if (typeof body.duration === "number") {
      data.duration = body.duration;
    }
    if (body.metadata !== undefined) {
      data.metadata = body.metadata;
    }
    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }
    if (body.expiresAt !== undefined) {
      data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }

    const updated = await getConditionService().updateAppliedCondition(id, data);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, appliedCondition: updated }));
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({ error: getErrorMessage(error) || "Failed to update applied condition" }),
    );
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

    const success = await getConditionService().removeCondition(id);

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Applied condition not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({ error: getErrorMessage(error) || "Failed to remove applied condition" }),
    );
  }
};

// PUT /conditions/:conditionId - Update condition
export const updateConditionHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.conditionId || ctx.url.pathname.split("/")[2];
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing conditionId" }));
      return;
    }

    const body = await parseJsonBody<UpdateConditionBody>(ctx.req);

    const updated = await getConditionService().updateCondition(id, body);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, condition: updated }));
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to update condition" }));
  }
};

// DELETE /conditions/:conditionId - Delete condition
export const deleteConditionHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.conditionId || ctx.url.pathname.split("/")[2];
    if (!id) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing conditionId" }));
      return;
    }

    const success = await getConditionService().deleteCondition(id);

    if (!success) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Condition not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true }));
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: getErrorMessage(error) || "Failed to delete condition" }));
  }
};

// GET /conditions/stats - Get condition statistics
export const getConditionStatsHandler: RouteHandler = async (ctx) => {
  try {
    const stats = await getConditionService().getConditionStats();

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify(stats));
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({ error: getErrorMessage(error) || "Failed to get condition stats" }),
    );
  }
};

// POST /conditions/cleanup-expired - Clean up expired conditions
export const cleanupExpiredConditionsHandler: RouteHandler = async (ctx) => {
  try {
    const expired = await getConditionService().cleanupExpiredConditions();

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ success: true, expiredCount: expired.length, expired }));
  } catch (error) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({ error: getErrorMessage(error) || "Failed to cleanup expired conditions" }),
    );
  }
};
