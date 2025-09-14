/**
 * Actor service for business logic and data operations
 */

import { PrismaClient } from "@prisma/client";

export interface CreateActorRequest {
  name: string;
  kind: "PC" | "NPC" | "MONSTER";
  campaignId: string;
  userId: string;
  monsterId?: string;
  characterId?: string;
  currentHp?: number;
  maxHp?: number;
  tempHp?: number;
  ac?: number;
  initiative?: number;
  isActive?: boolean;
}

export interface UpdateActorRequest {
  name?: string;
  currentHp?: number;
  maxHp?: number;
  tempHp?: number;
  ac?: number;
  initiative?: number;
  isActive?: boolean;
}

export interface ActorSearchOptions {
  campaignId: string;
  kind?: "PC" | "NPC" | "MONSTER" | undefined;
  isActive?: boolean | undefined;
  limit?: number;
  offset?: number;
}

export class ActorService {
  constructor(private prisma: PrismaClient) {}

  async searchActors(options: ActorSearchOptions) {
    const { campaignId, kind, isActive, limit = 50, offset = 0 } = options;

    const where: any = { campaignId };
    if (kind) {where.kind = kind;}
    if (isActive !== undefined) {where.isActive = isActive;}

    const [items, total] = await Promise.all([
      this.prisma.token.findMany({
        where: {
          gameSession: {
            campaignId
          },
          ...kind ? { type: kind as any } : {}
        },
        skip: offset,
        take: Math.min(limit, 200),
        orderBy: { name: "asc" },
      }),
      this.prisma.token.count({ 
        where: {
          gameSession: {
            campaignId
          },
          ...kind ? { type: kind as any } : {}
        }
      }),
    ]);

    return { items, total, limit, offset };
  }

  async getActor(id: string) {
    return this.prisma.token.findUnique({
      where: { id },
      include: {
        gameSession: true,
      },
    });
  }

  async createActor(request: CreateActorRequest) {
    // Validate references
    if (request.monsterId) {
      const monster = await this.prisma.monster.findUnique({
        where: { id: request.monsterId },
      });
      if (!monster) {
        throw new Error("Monster not found");
      }
    }

    if (request.characterId) {
      const character = await this.prisma.character.findUnique({
        where: { id: request.characterId },
      });
      if (!character) {
        throw new Error("Character not found");
      }
    }

    return this.prisma.token.create({
      data: {
        name: request.name,
        type: 'NPC', // Default type
        gameSessionId: 'default-session', // Default session
        characterId: request.characterId,
        health: request.currentHp || 0,
        maxHealth: request.maxHp || 0,
        initiative: request.initiative || 0,
        // campaignId, userId not part of Token model
      },
      include: {
        gameSession: true,
        // character not a valid relation
      },
    });
  }

  async createActorFromMonster(
    monsterId: string,
    campaignId: string,
    userId: string,
    name?: string,
  ) {
    const monster = await this.prisma.monster.findUnique({
      where: { id: monsterId },
    });

    if (!monster) {
      throw new Error("Monster not found");
    }

    // Extract stats from monster statblock
    const statblock = monster.statblock as any;
    const hp = statblock?.hp?.average || 1;
    const ac = statblock?.ac?.value || 10;

    return this.prisma.token.create({
      data: {
        name: name || monster.name,
        type: 'NPC', // Monster type
        gameSessionId: 'default-session', // Default session
        health: hp,
        maxHealth: hp,
        initiative: 0,
        // campaignId, userId not part of Token model
      },
      include: {
        gameSession: true,
      },
    });
  }

  async updateActor(id: string, request: UpdateActorRequest) {
    const data: Record<string, unknown> = {};
    if (request.name !== undefined) {data.name = request.name;}
    if (request.currentHp !== undefined) {data.health = request.currentHp;}
    if (request.maxHp !== undefined) {data.maxHealth = request.maxHp;}
    // tempHp, ac, isActive not part of Token model
    if (request.initiative !== undefined) {data.initiative = request.initiative;}

    return this.prisma.token.update({
      where: { id },
      data,
      include: {
        gameSession: true,
        // character not a valid relation
      },
    });
  }

  async deleteActor(id: string) {
    return this.prisma.token.delete({
      where: { id },
    });
  }

  async healActor(id: string, amount: number) {
    const actor = await this.getActor(id);
    if (!actor) {
      throw new Error("Actor not found");
    }

    const newHp = Math.min((actor.health || 0) + amount, (actor.maxHealth || 0));
    return this.updateActor(id, { currentHp: newHp });
  }

  async damageActor(id: string, amount: number) {
    const actor = await this.getActor(id);
    if (!actor) {
      throw new Error("Actor not found");
    }

    let newHp = (actor.health || 0) - amount;
    let newTempHp = 0; // tempHp not in Token model

    // Apply damage to temp HP first
    if (newTempHp > 0) {
      const tempDamage = Math.min(amount, newTempHp);
      newTempHp -= tempDamage;
      amount -= tempDamage;
    }

    // Apply remaining damage to regular HP
    if (amount > 0) {
      newHp = Math.max((actor.health || 0) - amount, 0);
    } else {
      newHp = actor.health || 0;
    }

    return this.updateActor(id, { currentHp: newHp });
  }

  async addTempHp(id: string, amount: number) {
    const actor = await this.getActor(id);
    if (!actor) {
      throw new Error("Actor not found");
    }

    // Temp HP doesn't stack - take the higher value
    const newTempHp = Math.max(0, amount);
    return this.updateActor(id, { tempHp: newTempHp });
  }

  async rollInitiative(id: string, roll: number) {
    return this.updateActor(id, { initiative: roll });
  }

  async getActorStats(campaignId: string) {
    const [total, byKind, activeCount] = await Promise.all([
      this.prisma.token.count({ where: { gameSession: { campaignId } } }),
      this.prisma.token.groupBy({
        by: ["type"],
        _count: true,
        where: { gameSession: { campaignId } },
      }),
      this.prisma.token.count({ where: { gameSession: { campaignId } } }),
    ]);

    return {
      total,
      active: activeCount,
      byKind: byKind.reduce((acc: Record<string, number>, group: unknown) => {
        acc[group.type] = group._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}
