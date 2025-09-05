/**
 * Actor routes with service integration and error handling
 */

import { RouteHandler } from "../router/types";
import { ActorService } from "../services/ActorService";
import {
  handleRouteError,
  validateRequired,
  validateEnum,
  validateString,
  validateNumber,
  validateUUID,
  NotFoundError,
} from "../middleware/errorHandler";
import { getAuthenticatedUserId } from "../middleware/auth";

// GET /actors - List actors for a campaign
export const listActorsHandler: RouteHandler = async (ctx) => {
  try {
    const campaignId = ctx.url.searchParams.get("campaignId");
    const kind = ctx.url.searchParams.get("kind") as "PC" | "NPC" | "MONSTER" | undefined;
    const isActive =
      ctx.url.searchParams.get("isActive") === "true"
        ? true
        : ctx.url.searchParams.get("isActive") === "false"
          ? false
          : undefined;
    const limit = parseInt(ctx.url.searchParams.get("limit") || "50");
    const offset = parseInt(ctx.url.searchParams.get("offset") || "0");

    if (!campaignId) {
      throw new NotFoundError("Campaign", "missing campaignId parameter");
    }

    validateUUID(campaignId, "campaignId");
    if (kind) {validateEnum(kind, ["PC", "NPC", "MONSTER"], "kind");}

    const actorService = new ActorService(ctx.prisma);
    const result = await actorService.searchActors({ campaignId, kind, isActive, limit, offset });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify(result));
  } catch (error: any) {
    handleRouteError(ctx, error);
  }
};

// GET /actors/:actorId - Get actor by ID
export const getActorHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.actorId || ctx.url.pathname.split("/")[2];
    if (!id) {
      throw new NotFoundError("Actor", "missing actorId");
    }

    validateUUID(id, "actorId");

    const actorService = new ActorService(ctx.prisma);
    const actor = await actorService.getActor(id);

    if (!actor) {
      throw new NotFoundError("Actor", id);
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify(actor));
  } catch (error: any) {
    handleRouteError(ctx, error);
  }
};

// POST /actors - Create a new actor
export const createActorHandler: RouteHandler = async (ctx) => {
  try {
    let body = "";
    ctx.req.on("data", (chunk) => (body += chunk));
    ctx.req.on("end", async () => {
      try {
        const data = JSON.parse(body);

        validateRequired(data, ["name", "campaignId", "kind"]);
        validateString(data.name, "name", { minLength: 1, maxLength: 200 });
        validateUUID(data.campaignId, "campaignId");
        validateEnum(data.kind, ["PC", "NPC", "MONSTER"], "kind");

        if (data.monsterId) {validateUUID(data.monsterId, "monsterId");}
        if (data.characterId) {validateUUID(data.characterId, "characterId");}
        if (data.currentHp !== undefined) {validateNumber(data.currentHp, "currentHp", { min: 0 });}
        if (data.maxHp !== undefined) {validateNumber(data.maxHp, "maxHp", { min: 0 });}
        if (data.tempHp !== undefined) {validateNumber(data.tempHp, "tempHp", { min: 0 });}
        if (data.ac !== undefined) {validateNumber(data.ac, "ac", { min: 0, max: 50 });}
        if (data.initiative !== undefined) {validateNumber(data.initiative, "initiative");}

        const actorService = new ActorService(ctx.prisma);
        const actor = await actorService.createActor({
          name: data.name,
          kind: data.kind,
          campaignId: data.campaignId,
          userId: getAuthenticatedUserId(ctx),
          monsterId: data.monsterId,
          characterId: data.characterId,
          currentHp: data.currentHp,
          maxHp: data.maxHp,
          tempHp: data.tempHp,
          ac: data.ac,
          initiative: data.initiative,
          isActive: data.isActive,
        });

        ctx.res.writeHead(201, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify(actor));
      } catch (error: any) {
        handleRouteError(ctx, error);
      }
    });
  } catch (error: any) {
    handleRouteError(ctx, error);
  }
};

// POST /actors/from-monster - Create actor from monster template
export const createActorFromMonsterHandler: RouteHandler = async (ctx) => {
  try {
    let body = "";
    ctx.req.on("data", (chunk) => (body += chunk));
    ctx.req.on("end", async () => {
      try {
        const data = JSON.parse(body);

        validateRequired(data, ["monsterId", "campaignId"]);
        validateUUID(data.monsterId, "monsterId");
        validateUUID(data.campaignId, "campaignId");
        if (data.name) {validateString(data.name, "name", { minLength: 1, maxLength: 200 });}

        const actorService = new ActorService(ctx.prisma);
        const actor = await actorService.createActorFromMonster(
          data.monsterId,
          data.campaignId,
          getAuthenticatedUserId(ctx),
          data.name,
        );

        ctx.res.writeHead(201, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify(actor));
      } catch (error: any) {
        handleRouteError(ctx, error);
      }
    });
  } catch (error: any) {
    handleRouteError(ctx, error);
  }
};

// PUT /actors/:actorId - Update actor
export const updateActorHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.actorId || ctx.url.pathname.split("/")[2];
    if (!id) {
      throw new NotFoundError("Actor", "missing actorId");
    }

    validateUUID(id, "actorId");

    let body = "";
    ctx.req.on("data", (chunk) => (body += chunk));
    ctx.req.on("end", async () => {
      try {
        const data = JSON.parse(body);

        if (data.name !== undefined)
          {validateString(data.name, "name", { minLength: 1, maxLength: 200 });}
        if (data.currentHp !== undefined) {validateNumber(data.currentHp, "currentHp", { min: 0 });}
        if (data.maxHp !== undefined) {validateNumber(data.maxHp, "maxHp", { min: 0 });}
        if (data.tempHp !== undefined) {validateNumber(data.tempHp, "tempHp", { min: 0 });}
        if (data.ac !== undefined) {validateNumber(data.ac, "ac", { min: 0, max: 50 });}
        if (data.initiative !== undefined) {validateNumber(data.initiative, "initiative");}

        const actorService = new ActorService(ctx.prisma);
        const actor = await actorService.updateActor(id, {
          name: data.name,
          currentHp: data.currentHp,
          maxHp: data.maxHp,
          tempHp: data.tempHp,
          ac: data.ac,
          initiative: data.initiative,
          isActive: data.isActive,
        });

        ctx.res.writeHead(200, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify(actor));
      } catch (error: any) {
        handleRouteError(ctx, error);
      }
    });
  } catch (error: any) {
    handleRouteError(ctx, error);
  }
};

// DELETE /actors/:actorId - Delete actor
export const deleteActorHandler: RouteHandler = async (ctx) => {
  try {
    const id = ctx.params?.actorId || ctx.url.pathname.split("/")[2];
    if (!id) {
      throw new NotFoundError("Actor", "missing actorId");
    }

    validateUUID(id, "actorId");

    const actorService = new ActorService(ctx.prisma);
    await actorService.deleteActor(id);

    ctx.res.writeHead(204);
    ctx.res.end();
  } catch (error: any) {
    handleRouteError(ctx, error);
  }
};
