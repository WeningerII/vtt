/**
 * Token service for business logic and data operations
 */

import { PrismaClient } from "@prisma/client";

export interface CreateTokenRequest {
  name: string;
  gameSessionId: string;
  sceneId?: string;
  characterId?: string;
  x: number;
  y: number;
  z?: number;
  rotation?: number;
  scale?: number;
  type?: "PC" | "NPC" | "MONSTER" | "OBJECT" | "EFFECT";
  visibility?: "VISIBLE" | "HIDDEN" | "PARTIAL" | "REVEALED";
  health?: number;
  maxHealth?: number;
  initiative?: number;
  speed?: number;
  imageUrl?: string;
  metadata?: any;
}

export interface UpdateTokenRequest {
  name?: string;
  x?: number;
  y?: number;
  z?: number;
  rotation?: number;
  scale?: number;
  type?: "PC" | "NPC" | "MONSTER" | "OBJECT" | "EFFECT";
  visibility?: "VISIBLE" | "HIDDEN" | "PARTIAL" | "REVEALED";
  health?: number;
  maxHealth?: number;
  initiative?: number;
  speed?: number;
  imageUrl?: string;
  metadata?: any;
}

export interface TokenSearchOptions {
  gameSessionId: string;
  sceneId?: string;
  characterId?: string;
  type?: "PC" | "NPC" | "MONSTER" | "OBJECT" | "EFFECT";
  visibility?: "VISIBLE" | "HIDDEN" | "PARTIAL" | "REVEALED";
  limit?: number;
  offset?: number;
}

export class TokenService {
  constructor(private prisma: PrismaClient) {}

  async searchTokens(options: TokenSearchOptions) {
    const { gameSessionId, sceneId, characterId, type, visibility, limit = 100, offset = 0 } = options;

    const where: any = { gameSessionId };
    if (sceneId) {where.sceneId = sceneId;}
    if (characterId) {where.characterId = characterId;}
    if (type) {where.type = type;}
    if (visibility) {where.visibility = visibility;}

    const [items, total] = await Promise.all([
      this.prisma.token.findMany({
        where,
        skip: offset,
        take: Math.min(limit, 500),
        orderBy: { name: "asc" },
        include: {
          gameSession: true,
          encounterTokens: true,
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
        gameSession: true,
        encounterTokens: {
          include: {
            encounter: true,
          },
        },
      },
    });
  }

  async createToken(request: CreateTokenRequest) {
    // Validate game session exists
    const gameSession = await this.prisma.gameSession.findUnique({
      where: { id: request.gameSessionId },
    });
    if (!gameSession) {
      throw new Error("Game session not found");
    }

    return this.prisma.token.create({
      data: {
        name: request.name,
        gameSessionId: request.gameSessionId,
        sceneId: request.sceneId,
        characterId: request.characterId,
        type: request.type || "OBJECT",
        visibility: request.visibility || "VISIBLE",
        x: request.x,
        y: request.y,
        z: request.z || 0,
        rotation: request.rotation || 0,
        scale: request.scale || 1.0,
        health: request.health,
        maxHealth: request.maxHealth,
        initiative: request.initiative,
        speed: request.speed || 30,
        imageUrl: request.imageUrl,
        metadata: request.metadata,
      },
      include: {
        gameSession: true,
        encounterTokens: true,
      },
    });
  }

  async createTokenFromCharacter(
    characterId: string,
    gameSessionId: string,
    sceneId: string,
    x: number,
    y: number,
    options: Partial<CreateTokenRequest> = {},
  ) {
    // For now, create a basic token - character integration can be added later
    return this.createToken({
      name: options.name || "Character Token",
      gameSessionId,
      sceneId,
      characterId,
      type: "PC",
      x,
      y,
      z: options.z || 0,
      rotation: options.rotation || 0,
      scale: options.scale || 1.0,
      visibility: options.visibility || "VISIBLE",
      health: options.health,
      maxHealth: options.maxHealth,
      initiative: options.initiative,
      speed: options.speed || 30,
      imageUrl: options.imageUrl,
      metadata: options.metadata,
    });
  }

  async updateToken(id: string, request: UpdateTokenRequest) {
    const data: any = {};
    if (request.name !== undefined) {data.name = request.name;}
    if (request.x !== undefined) {data.x = request.x;}
    if (request.y !== undefined) {data.y = request.y;}
    if (request.z !== undefined) {data.z = request.z;}
    if (request.rotation !== undefined) {data.rotation = request.rotation;}
    if (request.scale !== undefined) {data.scale = request.scale;}
    if (request.type !== undefined) {data.type = request.type;}
    if (request.visibility !== undefined) {data.visibility = request.visibility;}
    if (request.health !== undefined) {data.health = request.health;}
    if (request.maxHealth !== undefined) {data.maxHealth = request.maxHealth;}
    if (request.initiative !== undefined) {data.initiative = request.initiative;}
    if (request.speed !== undefined) {data.speed = request.speed;}
    if (request.imageUrl !== undefined) {data.imageUrl = request.imageUrl;}
    if (request.metadata !== undefined) {data.metadata = request.metadata;}

    return this.prisma.token.update({
      where: { id },
      data,
      include: {
        gameSession: true,
        encounterTokens: true,
      },
    });
  }

  async moveToken(id: string, x: number, y: number, rotation?: number) {
    const data: any = { x, y };
    if (rotation !== undefined) {data.rotation = rotation;}

    return this.updateToken(id, data);
  }

  async deleteToken(id: string) {
    return this.prisma.token.delete({
      where: { id },
    });
  }

  async getTokensInArea(gameSessionId: string, sceneId: string, x1: number, y1: number, x2: number, y2: number) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    return this.prisma.token.findMany({
      where: {
        gameSessionId,
        sceneId,
        x: { gte: minX, lte: maxX },
        y: { gte: minY, lte: maxY },
      },
      include: {
        gameSession: true,
        encounterTokens: true,
      },
    });
  }

  async getTokensNear(gameSessionId: string, sceneId: string, x: number, y: number, radius: number) {
    // Simple distance check - could be optimized with spatial indexing
    const tokens = await this.prisma.token.findMany({
      where: { gameSessionId, sceneId },
      include: {
        gameSession: true,
        encounterTokens: true,
      },
    });

    return tokens.filter((token) => {
      const distance = Math.sqrt(Math.pow(token.x - x, 2) + Math.pow(token.y - y, 2));
      return distance <= radius;
    });
  }

  async setTokenVisibility(id: string, visibility: "VISIBLE" | "HIDDEN" | "PARTIAL" | "REVEALED") {
    return this.updateToken(id, { visibility });
  }

  // Lock functionality not in schema - could be added to metadata if needed
  async setTokenMetadata(id: string, metadata: any) {
    return this.updateToken(id, { metadata });
  }

  async getTokenStats(gameSessionId: string, sceneId?: string) {
    const where: any = { gameSessionId };
    if (sceneId) where.sceneId = sceneId;

    const [total, byType, byVisibility, visible] = await Promise.all([
      this.prisma.token.count({ where }),
      this.prisma.token.groupBy({
        by: ["type"],
        where,
        _count: true,
      }),
      this.prisma.token.groupBy({
        by: ["visibility"],
        where,
        _count: true,
      }),
      this.prisma.token.count({ where: { ...where, visibility: "VISIBLE" } }),
    ]);

    return {
      total,
      visible,
      byType: byType.reduce(
        (acc, group) => {
          acc[group.type] = group._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      byVisibility: byVisibility.reduce(
        (acc, group) => {
          acc[group.visibility] = group._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  async getTokensByGameSession(gameSessionId: string) {
    return this.prisma.token.findMany({
      where: { gameSessionId },
      include: {
        gameSession: true,
        encounterTokens: true,
      },
      orderBy: { name: "asc" },
    });
  }
}
