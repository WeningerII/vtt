/**
 * Token service for business logic and data operations
 */

import { PrismaClient } from "@prisma/client";

export interface CreateTokenRequest {
  name: string;
  sceneId: string;
  actorId?: string;
  assetId?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  scale?: number;
  disposition?: "FRIENDLY" | "NEUTRAL" | "HOSTILE" | "UNKNOWN";
  isVisible?: boolean;
  isLocked?: boolean;
  layer?: number;
}

export interface UpdateTokenRequest {
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  scale?: number;
  disposition?: "FRIENDLY" | "NEUTRAL" | "HOSTILE" | "UNKNOWN";
  isVisible?: boolean;
  isLocked?: boolean;
  layer?: number;
}

export interface TokenSearchOptions {
  sceneId: string;
  actorId?: string | undefined;
  disposition?: "FRIENDLY" | "NEUTRAL" | "HOSTILE" | "UNKNOWN" | undefined;
  isVisible?: boolean | undefined;
  layer?: number | undefined;
  limit?: number;
  offset?: number;
}

export class TokenService {
  constructor(private prisma: PrismaClient) {}

  async searchTokens(options: TokenSearchOptions) {
    const { sceneId, actorId, disposition, isVisible, layer, limit = 100, offset = 0 } = options;

    const where: any = { sceneId };
    if (actorId) where.actorId = actorId;
    if (disposition) where.disposition = disposition;
    if (isVisible !== undefined) where.isVisible = isVisible;
    if (layer !== undefined) where.layer = layer;

    const [items, total] = await Promise.all([
      this.prisma.token.findMany({
        where,
        skip: offset,
        take: Math.min(limit, 500),
        orderBy: { name: "asc" },
        include: {
          actor: {
            include: {
              monster: true,
              character: true,
            },
          },
          asset: true,
          appliedConditions: {
            include: {
              condition: true,
            },
          },
        },
      }),
      this.prisma.token.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getToken(id: string) {
    return this.prisma.token.findUnique({
      where: { id },
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
        asset: true,
        appliedConditions: {
          include: {
            condition: true,
          },
        },
      },
    });
  }

  async createToken(request: CreateTokenRequest) {
    // Validate references
    if (request.actorId) {
      const actor = await this.prisma.actor.findUnique({
        where: { id: request.actorId },
      });
      if (!actor) {
        throw new Error("Actor not found");
      }
    }

    if (request.assetId) {
      const asset = await this.prisma.asset.findUnique({
        where: { id: request.assetId },
      });
      if (!asset) {
        throw new Error("Asset not found");
      }
    }

    return this.prisma.token.create({
      data: {
        name: request.name,
        sceneId: request.sceneId,
        actorId: request.actorId,
        assetId: request.assetId,
        x: request.x,
        y: request.y,
        width: request.width || 1,
        height: request.height || 1,
        rotation: request.rotation || 0,
        scale: request.scale || 1.0,
        disposition: request.disposition || "NEUTRAL",
        isVisible: request.isVisible !== false,
        isLocked: request.isLocked === true,
        layer: request.layer || 0,
      },
      include: {
        actor: {
          include: {
            monster: true,
            character: true,
          },
        },
        asset: true,
      },
    });
  }

  async createTokenFromActor(
    actorId: string,
    sceneId: string,
    x: number,
    y: number,
    options: Partial<CreateTokenRequest> = {},
  ) {
    const actor = await this.prisma.actor.findUnique({
      where: { id: actorId },
      include: {
        monster: true,
        character: true,
      },
    });

    if (!actor) {
      throw new Error("Actor not found");
    }

    // Determine token size from monster statblock if available
    let width = 1;
    let height = 1;
    if (actor.monster?.statblock) {
      const statblock = actor.monster.statblock as any;
      const size = statblock.size;
      // Map D&D sizes to grid squares
      switch (size) {
        case "TINY":
          width = height = 0.5;
          break;
        case "SMALL":
        case "MEDIUM":
          width = height = 1;
          break;
        case "LARGE":
          width = height = 2;
          break;
        case "HUGE":
          width = height = 3;
          break;
        case "GARGANTUAN":
          width = height = 4;
          break;
        default:
          width = height = 1;
      }
    }

    // Determine disposition based on actor kind
    let disposition: "FRIENDLY" | "NEUTRAL" | "HOSTILE" | "UNKNOWN" = "NEUTRAL";
    if (actor.kind === "PC") disposition = "FRIENDLY";
    else if (actor.kind === "MONSTER") disposition = "HOSTILE";

    return this.createToken({
      name: options.name || actor.name,
      sceneId,
      actorId: actor.id,
      assetId: options.assetId,
      x,
      y,
      width: options.width || width,
      height: options.height || height,
      rotation: options.rotation || 0,
      scale: options.scale || 1.0,
      disposition: options.disposition || disposition,
      isVisible: options.isVisible !== false,
      isLocked: options.isLocked === true,
      layer: options.layer || 0,
    });
  }

  async updateToken(id: string, request: UpdateTokenRequest) {
    const data: any = {};
    if (request.name !== undefined) data.name = request.name;
    if (request.x !== undefined) data.x = request.x;
    if (request.y !== undefined) data.y = request.y;
    if (request.width !== undefined) data.width = request.width;
    if (request.height !== undefined) data.height = request.height;
    if (request.rotation !== undefined) data.rotation = request.rotation;
    if (request.scale !== undefined) data.scale = request.scale;
    if (request.disposition !== undefined) data.disposition = request.disposition;
    if (request.isVisible !== undefined) data.isVisible = request.isVisible;
    if (request.isLocked !== undefined) data.isLocked = request.isLocked;
    if (request.layer !== undefined) data.layer = request.layer;

    return this.prisma.token.update({
      where: { id },
      data,
      include: {
        actor: {
          include: {
            monster: true,
            character: true,
          },
        },
        asset: true,
      },
    });
  }

  async moveToken(id: string, x: number, y: number, rotation?: number) {
    const data: any = { x, y };
    if (rotation !== undefined) data.rotation = rotation;

    return this.updateToken(id, data);
  }

  async deleteToken(id: string) {
    return this.prisma.token.delete({
      where: { id },
    });
  }

  async getTokensInArea(sceneId: string, x1: number, y1: number, x2: number, y2: number) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    return this.prisma.token.findMany({
      where: {
        sceneId,
        x: { gte: minX, lte: maxX },
        y: { gte: minY, lte: maxY },
      },
      include: {
        actor: {
          include: {
            monster: true,
            character: true,
          },
        },
        asset: true,
      },
    });
  }

  async getTokensNear(sceneId: string, x: number, y: number, radius: number) {
    // Simple distance check - could be optimized with spatial indexing
    const tokens = await this.prisma.token.findMany({
      where: { sceneId },
      include: {
        actor: {
          include: {
            monster: true,
            character: true,
          },
        },
        asset: true,
      },
    });

    return tokens.filter((token) => {
      const distance = Math.sqrt(Math.pow(token.x - x, 2) + Math.pow(token.y - y, 2));
      return distance <= radius;
    });
  }

  async setTokenVisibility(id: string, isVisible: boolean) {
    return this.updateToken(id, { isVisible });
  }

  async lockToken(id: string, isLocked: boolean) {
    return this.updateToken(id, { isLocked });
  }

  async getTokenStats(sceneId: string) {
    const [total, byDisposition, byLayer, visible] = await Promise.all([
      this.prisma.token.count({ where: { sceneId } }),
      this.prisma.token.groupBy({
        by: ["disposition"],
        where: { sceneId },
        _count: true,
      }),
      this.prisma.token.groupBy({
        by: ["layer"],
        where: { sceneId },
        _count: true,
      }),
      this.prisma.token.count({ where: { sceneId, isVisible: true } }),
    ]);

    return {
      total,
      visible,
      byDisposition: byDisposition.reduce(
        (_acc, _group) => {
          acc[group.disposition] = group._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      byLayer: byLayer.reduce(
        (_acc, _group) => {
          acc[group.layer] = group._count;
          return acc;
        },
        {} as Record<number, number>,
      ),
    };
  }
}
