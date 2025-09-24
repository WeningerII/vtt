import { Prisma, PrismaClient } from "@prisma/client";
import { getErrorMessage } from "../utils/errors";
import { logger } from "@vtt/logging";
import { Context } from "../router/types";

export async function getSceneHandler(ctx: Context) {
  const sceneId = ctx.url.pathname.split("/").pop();
  if (!sceneId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Scene ID required" }));
    return;
  }

  try {
    const scene = await ctx.prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        campaign: true,
        map: true,
      },
    });

    if (!scene) {
      ctx.res.writeHead(404, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Scene not found" }));
      return;
    }

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify(scene));
  } catch (error) {
    logger.error("Error fetching scene:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Internal server error" }));
  }
}

export async function createSceneHandler(ctx: Context) {
  if (ctx.req.method !== "POST") {
    ctx.res.writeHead(405, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body = "";
  ctx.req.on("data", (chunk: unknown) => (body += chunk));
  ctx.req.on("end", async () => {
    try {
      const data = JSON.parse(body);
      const { name, campaignId, gridSettings, lightingSettings, fogSettings } = data;

      if (!name || !campaignId) {
        ctx.res.writeHead(400, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify({ error: "Name and campaignId are required" }));
        return;
      }

      const scene = await ctx.prisma.scene.create({
        data: {
          name,
          campaignId,
          // lightingSettings and fogSettings not part of Scene model
        },
      });

      ctx.res.writeHead(201, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify(scene));
    } catch (error) {
      logger.error("Error creating scene:", error);
      ctx.res.writeHead(500, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Internal server error" }));
    }
  });
}

export async function updateSceneHandler(ctx: Context) {
  if (ctx.req.method !== "PUT") {
    ctx.res.writeHead(405, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const sceneId = ctx.url.pathname.split("/").pop();
  if (!sceneId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Scene ID required" }));
    return;
  }

  let body = "";
  ctx.req.on("data", (chunk: unknown) => (body += chunk));
  ctx.req.on("end", async () => {
    try {
      const data = JSON.parse(body) as Record<string, unknown>;
      const updateData: Prisma.SceneUpdateInput = {};

      if (typeof data.name === "string" && data.name.trim()) {
        updateData.name = data.name;
      }

      if (Object.keys(updateData).length === 0) {
        ctx.res.writeHead(400, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify({ error: "No valid fields to update" }));
        return;
      }

      const scene = await ctx.prisma.scene.update({
        where: { id: sceneId },
        data: updateData,
        include: {
          campaign: true,
          map: true,
        },
      });

      ctx.res.writeHead(200, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify(scene));
    } catch (error) {
      logger.error("Error updating scene:", error);
      ctx.res.writeHead(500, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Internal server error" }));
    }
  });
}

export async function createTokenHandler(ctx: Context) {
  if (ctx.req.method !== "POST") {
    ctx.res.writeHead(405, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body = "";
  ctx.req.on("data", (chunk: unknown) => (body += chunk));
  ctx.req.on("end", async () => {
    try {
      const data = JSON.parse(body);
      const {
        name,
        sceneId,
        assetId,
        x,
        y,
        width = 1,
        height = 1,
        rotation = 0,
        scale = 1.0,
        disposition = "NEUTRAL",
        isVisible = true,
        layer = 0,
      } = data;

      if (!name || !sceneId || x === undefined || y === undefined) {
        ctx.res.writeHead(400, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify({ error: "Name, sceneId, x, and y are required" }));
        return;
      }

      const token = await ctx.prisma.token.create({
        data: {
          name,
          type: "NPC", // Default type
          gameSessionId: "default-session", // Default session ID
          sceneId,
          x,
          y,
          rotation,
          scale,
        },
        include: {
          gameSession: true,
        },
      });

      ctx.res.writeHead(201, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify(token));
    } catch (error) {
      logger.error("Error creating token:", error);
      ctx.res.writeHead(500, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Internal server error" }));
    }
  });
}

export async function updateTokenHandler(ctx: Context) {
  if (ctx.req.method !== "PUT") {
    ctx.res.writeHead(405, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const tokenId = ctx.url.pathname.split("/").pop();
  if (!tokenId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Token ID required" }));
    return;
  }

  let body = "";
  ctx.req.on("data", (chunk: unknown) => (body += chunk));
  ctx.req.on("end", async () => {
    try {
      const data = JSON.parse(body) as Record<string, unknown>;
      const updateData: any = {};

      if (typeof data.name === "string" && data.name.trim()) {
        updateData.name = data.name;
      }
      if (typeof data.x === "number" && Number.isFinite(data.x)) {
        updateData.x = data.x;
      }
      if (typeof data.y === "number" && Number.isFinite(data.y)) {
        updateData.y = data.y;
      }
      if (typeof data.rotation === "number" && Number.isFinite(data.rotation)) {
        updateData.rotation = data.rotation;
      }
      if (typeof data.scale === "number" && Number.isFinite(data.scale)) {
        updateData.scale = data.scale;
      }

      if (Object.keys(updateData).length === 0) {
        ctx.res.writeHead(400, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify({ error: "No valid fields to update" }));
        return;
      }

      const token = await ctx.prisma.token.update({
        where: { id: tokenId },
        data: updateData,
        include: {
          gameSession: true,
        },
      });

      ctx.res.writeHead(200, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify(token));
    } catch (error) {
      logger.error("Error updating token:", error);
      ctx.res.writeHead(500, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Internal server error" }));
    }
  });
}

export async function deleteTokenHandler(ctx: Context) {
  if (ctx.req.method !== "DELETE") {
    ctx.res.writeHead(405, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const tokenId = ctx.url.pathname.split("/").pop();
  if (!tokenId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Token ID required" }));
    return;
  }

  try {
    await ctx.prisma.token.delete({
      where: { id: tokenId },
    });

    ctx.res.writeHead(204);
    ctx.res.end();
  } catch (error) {
    logger.error("Error deleting token:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Internal server error" }));
  }
}

export async function getCampaignScenesHandler(ctx: Context) {
  const campaignId = ctx.url.pathname.split("/")[3]; // /api/campaigns/:id/scenes
  if (!campaignId) {
    ctx.res.writeHead(400, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Campaign ID required" }));
    return;
  }

  try {
    const scenes = await ctx.prisma.scene.findMany({
      where: { campaignId },
      orderBy: { createdAt: "asc" },
    });

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify(scenes));
  } catch (error) {
    logger.error("Error fetching campaign scenes:", error);
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Internal server error" }));
  }
}
