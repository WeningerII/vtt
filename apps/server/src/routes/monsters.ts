/**
 * Monster routes with service integration and error handling
 */

import { RouteHandler } from "../router/types";
import { MonsterService } from "../services/MonsterService";
import {
  handleRouteError,
  validateRequired,
  validateString,
  validateArray,
  NotFoundError,
} from "../middleware/errorHandler";

export const seedSRDMonstersHandler: RouteHandler = async (ctx) => {
  try {
    const monsterService = new MonsterService(ctx.prisma);
    const result = await monsterService.seedSRDMonsters();

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ 
      success: true, 
      message: `Successfully seeded SRD monsters`,
      ...result 
    }));
  } catch (error: any) {
    handleRouteError(ctx, error);
  }
};

export const listMonstersHandler: RouteHandler = async (ctx) => {
  try {
    const monsterService = new MonsterService(ctx.prisma);
    const query = ctx.url.searchParams.get("q") || undefined;
    const tags = ctx.url.searchParams.get("tags")?.split(",").filter(Boolean) || undefined;
    const limit = parseInt(ctx.url.searchParams.get("limit") || "50");
    const offset = parseInt(ctx.url.searchParams.get("offset") || "0");

    const result = await monsterService.searchMonsters({ query, tags, limit, offset });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify(result));
  } catch (error: any) {
    handleRouteError(ctx, error);
  }
};

export const getMonsterHandler: RouteHandler = async (ctx) => {
  try {
    const idOrStableId = ctx.params?.id;
    if (!idOrStableId) {
      throw new NotFoundError("Monster", "missing id");
    }

    const monsterService = new MonsterService(ctx.prisma);
    const monster = await monsterService.getMonster(idOrStableId);

    if (!monster) {
      throw new NotFoundError("Monster", idOrStableId);
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify(monster));
  } catch (error: any) {
    handleRouteError(ctx, error);
  }
};

export const createMonsterHandler: RouteHandler = async (ctx) => {
  try {
    let body = "";
    ctx.req.on("data", (chunk) => (body += chunk));
    ctx.req.on("end", async () => {
      try {
        const data = JSON.parse(body);

        validateRequired(data, ["name", "statblock"]);
        validateString(data.name, "name", { minLength: 1, maxLength: 200 });
        if (data.stableId)
          {validateString(data.stableId, "stableId", { minLength: 1, maxLength: 100 });}
        if (data.tags) {validateArray(data.tags, "tags", { maxLength: 50 });}

        const monsterService = new MonsterService(ctx.prisma);
        const monster = await monsterService.createMonster({
          name: data.name,
          stableId: data.stableId,
          statblock: data.statblock,
          tags: data.tags,
        });

        ctx.res.writeHead(201, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify(monster));
      } catch (error: any) {
        handleRouteError(ctx, error);
      }
    });
  } catch (error: any) {
    handleRouteError(ctx, error);
  }
};

export const updateMonsterHandler: RouteHandler = async (ctx) => {
  try {
    const idOrStableId = ctx.params?.id;
    if (!idOrStableId) {
      throw new NotFoundError("Monster", "missing id");
    }

    let body = "";
    ctx.req.on("data", (chunk) => (body += chunk));
    ctx.req.on("end", async () => {
      try {
        const data = JSON.parse(body);

        if (data.name) {validateString(data.name, "name", { minLength: 1, maxLength: 200 });}
        if (data.tags) {validateArray(data.tags, "tags", { maxLength: 50 });}

        const monsterService = new MonsterService(ctx.prisma);
        const monster = await monsterService.updateMonster(idOrStableId, {
          name: data.name,
          statblock: data.statblock,
          tags: data.tags,
        });

        ctx.res.writeHead(200, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify(monster));
      } catch (error: any) {
        handleRouteError(ctx, error);
      }
    });
  } catch (error: any) {
    handleRouteError(ctx, error);
  }
};

export const deleteMonsterHandler: RouteHandler = async (ctx) => {
  try {
    const idOrStableId = ctx.params?.id;
    if (!idOrStableId) {
      throw new NotFoundError("Monster", "missing id");
    }

    const monsterService = new MonsterService(ctx.prisma);
    await monsterService.deleteMonster(idOrStableId);

    ctx.res.writeHead(204);
    ctx.res.end();
  } catch (error: any) {
    handleRouteError(ctx, error);
  }
};

export const getMonsterStatsHandler: RouteHandler = async (ctx) => {
  try {
    const monsterService = new MonsterService(ctx.prisma);
    const stats = await monsterService.getMonsterStats();

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify(stats));
  } catch (error: any) {
    handleRouteError(ctx, error);
  }
};
