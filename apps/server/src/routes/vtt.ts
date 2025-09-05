import { _PrismaClient } from "@prisma/client";
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
        tokens: {
          include: {
            actor: true,
            asset: true,
          },
        },
        campaign: true,
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
  ctx.req.on("data", (_chunk: any) => (body += chunk));
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
          gridSettings: JSON.stringify(
            gridSettings || {
              type: "square",
              size: 70,
              offsetX: 0,
              offsetY: 0,
            },
          ),
          lightingSettings: JSON.stringify(lightingSettings || {}),
          fogSettings: JSON.stringify(fogSettings || {}),
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
  ctx.req.on("data", (_chunk: any) => (body += chunk));
  ctx.req.on("end", async () => {
    try {
      const data = JSON.parse(body);
      const updateData: any = { updatedAt: new Date() };

      if (data.name !== undefined) {updateData.name = data.name;}
      if (data.gridSettings !== undefined)
        {updateData.gridSettings = JSON.stringify(data.gridSettings);}
      if (data.lightingSettings !== undefined)
        {updateData.lightingSettings = JSON.stringify(data.lightingSettings);}
      if (data.fogSettings !== undefined) {updateData.fogSettings = JSON.stringify(data.fogSettings);}

      const scene = await ctx.prisma.scene.update({
        where: { id: sceneId },
        data: updateData,
        include: {
          tokens: {
            include: {
              actor: true,
              asset: true,
            },
          },
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
  ctx.req.on("data", (_chunk: any) => (body += chunk));
  ctx.req.on("end", async () => {
    try {
      const data = JSON.parse(body);
      const {
        name,
        sceneId,
        actorId,
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
          sceneId,
          actorId: actorId || null,
          assetId: assetId || null,
          x,
          y,
          width,
          height,
          rotation,
          scale,
          disposition,
          isVisible,
          layer,
        },
        include: {
          actor: true,
          asset: true,
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
  ctx.req.on("data", (_chunk: any) => (body += chunk));
  ctx.req.on("end", async () => {
    try {
      const data = JSON.parse(body);
      const updateData: any = { updatedAt: new Date() };

      // Only update fields that are provided
      if (data.name !== undefined) {updateData.name = data.name;}
      if (data.x !== undefined) {updateData.x = data.x;}
      if (data.y !== undefined) {updateData.y = data.y;}
      if (data.width !== undefined) {updateData.width = data.width;}
      if (data.height !== undefined) {updateData.height = data.height;}
      if (data.rotation !== undefined) {updateData.rotation = data.rotation;}
      if (data.scale !== undefined) {updateData.scale = data.scale;}
      if (data.disposition !== undefined) {updateData.disposition = data.disposition;}
      if (data.isVisible !== undefined) {updateData.isVisible = data.isVisible;}
      if (data.isLocked !== undefined) {updateData.isLocked = data.isLocked;}
      if (data.layer !== undefined) {updateData.layer = data.layer;}

      const token = await ctx.prisma.token.update({
        where: { id: tokenId },
        data: updateData,
        include: {
          actor: true,
          asset: true,
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
      include: {
        _count: {
          select: { tokens: true },
        },
      },
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
