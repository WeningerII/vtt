/**
 * Condition service for business logic and status effect management
 */

import { PrismaClient } from "@prisma/client";

export interface CreateConditionRequest {
  name: string;
  type: "BUFF" | "DEBUFF" | "NEUTRAL";
  description?: string;
  duration?: number;
  metadata?: any;
}

export interface UpdateConditionRequest {
  name?: string;
  type?: "BUFF" | "DEBUFF" | "NEUTRAL";
  description?: string;
  duration?: number;
  metadata?: any;
}

export interface ApplyConditionRequest {
  conditionId: string;
  duration?: number;
  metadata?: any;
  appliedBy?: string;
}

export interface ConditionSearchOptions {
  type?: "BUFF" | "DEBUFF" | "NEUTRAL" | undefined;
  limit?: number;
  offset?: number;
}

export class ConditionService {
  constructor(private prisma: PrismaClient) {}

  async searchConditions(options: ConditionSearchOptions = {}) {
    const { type,  limit = 50,  offset = 0  } = options;

    const where: any = {};
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      this.prisma.condition.findMany({
        where,
        skip: offset,
        take: Math.min(limit, 200),
        orderBy: { name: "asc" },
      }),
      this.prisma.condition.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getCondition(id: string) {
    return this.prisma.condition.findUnique({
      where: { id },
      include: {
        appliedConditions: {
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
  }

  async createCondition(request: CreateConditionRequest) {
    return this.prisma.condition.create({
      data: {
        name: request.name,
        type: request.type,
        description: request.description || "",
        duration: request.duration,
        metadata: request.metadata || {},
      },
    });
  }

  async updateCondition(id: string, request: UpdateConditionRequest) {
    const data: any = {};
    if (request.name !== undefined) data.name = request.name;
    if (request.type !== undefined) data.type = request.type;
    if (request.description !== undefined) data.description = request.description;
    if (request.duration !== undefined) data.duration = request.duration;
    if (request.metadata !== undefined) data.metadata = request.metadata;

    return this.prisma.condition.update({
      where: { id },
      data,
    });
  }

  async deleteCondition(id: string) {
    return this.prisma.condition.delete({
      where: { id },
    });
  }

  async applyConditionToActor(actorId: string, request: ApplyConditionRequest) {
    // Validate condition exists
    const condition = await this.prisma.condition.findUnique({
      where: { id: request.conditionId },
    });
    if (!condition) {
      throw new Error("Condition not found");
    }

    // Validate actor exists
    const actor = await this.prisma.actor.findUnique({
      where: { id: actorId },
    });
    if (!actor) {
      throw new Error("Actor not found");
    }

    return this.prisma.appliedCondition.create({
      data: {
        conditionId: request.conditionId,
        actorId: actorId,
        duration: request.duration || condition.duration,
        metadata: request.metadata || {},
        appliedBy: request.appliedBy,
        appliedAt: new Date(),
      },
      include: {
        condition: true,
        actor: true,
      },
    });
  }

  async applyConditionToToken(tokenId: string, request: ApplyConditionRequest) {
    // Validate condition exists
    const condition = await this.prisma.condition.findUnique({
      where: { id: request.conditionId },
    });
    if (!condition) {
      throw new Error("Condition not found");
    }

    // Validate token exists
    const token = await this.prisma.token.findUnique({
      where: { id: tokenId },
    });
    if (!token) {
      throw new Error("Token not found");
    }

    return this.prisma.appliedCondition.create({
      data: {
        conditionId: request.conditionId,
        tokenId: tokenId,
        duration: request.duration || condition.duration,
        metadata: request.metadata || {},
        appliedBy: request.appliedBy,
        appliedAt: new Date(),
      },
      include: {
        condition: true,
        token: true,
      },
    });
  }

  async applyConditionToEncounterParticipant(participantId: string, request: ApplyConditionRequest) {
    // Validate condition exists
    const condition = await this.prisma.condition.findUnique({
      where: { id: request.conditionId },
    });
    if (!condition) {
      throw new Error("Condition not found");
    }

    // Validate participant exists
    const participant = await this.prisma.encounterParticipant.findUnique({
      where: { id: participantId },
    });
    if (!participant) {
      throw new Error("Encounter participant not found");
    }

    return this.prisma.appliedCondition.create({
      data: {
        conditionId: request.conditionId,
        encounterParticipantId: participantId,
        duration: request.duration || condition.duration,
        metadata: request.metadata || {},
        appliedBy: request.appliedBy,
        appliedAt: new Date(),
      },
      include: {
        condition: true,
        encounterParticipant: {
          include: {
            actor: true,
          },
        },
      },
    });
  }

  async removeAppliedCondition(appliedConditionId: string) {
    return this.prisma.appliedCondition.delete({
      where: { id: appliedConditionId },
    });
  }

  async getAppliedCondition(id: string) {
    return this.prisma.appliedCondition.findUnique({
      where: { id },
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
  }

  async getActorConditions(actorId: string) {
    return this.prisma.appliedCondition.findMany({
      where: { actorId },
      include: {
        condition: true,
      },
      orderBy: { appliedAt: "desc" },
    });
  }

  async getTokenConditions(tokenId: string) {
    return this.prisma.appliedCondition.findMany({
      where: { tokenId },
      include: {
        condition: true,
      },
      orderBy: { appliedAt: "desc" },
    });
  }

  async getEncounterParticipantConditions(participantId: string) {
    return this.prisma.appliedCondition.findMany({
      where: { encounterParticipantId: participantId },
      include: {
        condition: true,
      },
      orderBy: { appliedAt: "desc" },
    });
  }

  async updateAppliedCondition(id: string, updates: { duration?: number; metadata?: any }) {
    const data: any = {};
    if (updates.duration !== undefined) data.duration = updates.duration;
    if (updates.metadata !== undefined) data.metadata = updates.metadata;

    return this.prisma.appliedCondition.update({
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
  }

  async getConditionStats() {
    const [total, byType, activeCount] = await Promise.all([
      this.prisma.condition.count(),
      this.prisma.condition.groupBy({
        by: ["type"],
        _count: true,
      }),
      this.prisma.appliedCondition.count(),
    ]);

    return {
      total,
      active: activeCount,
      byType: byType.reduce((_acc: Record<string, _number>, group: any) => {
        acc[group.type] = group._count;
        return acc;
      }, {}),
    };
  }

  async cleanupExpiredConditions() {
    const now = new Date();
    
    // Find conditions that have expired (duration-based)
    const expiredConditions = await this.prisma.appliedCondition.findMany({
      where: {
        duration: { not: null },
        appliedAt: {
          lte: new Date(now.getTime() - (24 * 60 * 60 * 1000)), // Example: 24 hours ago
        },
      },
    });

    // Delete expired conditions
    const deletePromises = expiredConditions.map(condition =>
      this.prisma.appliedCondition.delete({
        where: { id: condition.id },
      })
    );

    await Promise.all(deletePromises);
    
    return { removed: expiredConditions.length };
  }
}
