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
    if (kind) where.kind = kind;
    if (isActive !== undefined) where.isActive = isActive;

    const [items, total] = await Promise.all([
      this.prisma.actor.findMany({
        where,
        skip: offset,
        take: Math.min(limit, 200),
        orderBy: { name: "asc" },
        include: {
          monster: true,
          character: true,
          tokens: true,
          appliedConditions: {
            include: {
              condition: true,
            },
          },
        },
      }),
      this.prisma.actor.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getActor(id: string) {
    return this.prisma.actor.findUnique({
      where: { id },
      include: {
        monster: true,
        character: true,
        tokens: true,
        appliedConditions: {
          include: {
            condition: true,
          },
        },
        encounterParticipants: {
          include: {
            encounter: true,
          },
        },
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

    return this.prisma.actor.create({
      data: {
        name: request.name,
        kind: request.kind,
        campaignId: request.campaignId,
        userId: request.userId,
        monsterId: request.monsterId,
        characterId: request.characterId,
        currentHp: request.currentHp || 0,
        maxHp: request.maxHp || 0,
        tempHp: request.tempHp || 0,
        ac: request.ac || 10,
        initiative: request.initiative || 0,
        isActive: request.isActive !== false,
      },
      include: {
        monster: true,
        character: true,
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

    return this.prisma.actor.create({
      data: {
        name: name || monster.name,
        kind: "MONSTER",
        campaignId,
        userId,
        monsterId: monster.id,
        currentHp: hp,
        maxHp: hp,
        tempHp: 0,
        ac: ac,
        initiative: 0,
        isActive: true,
      },
      include: {
        monster: true,
      },
    });
  }

  async updateActor(id: string, request: UpdateActorRequest) {
    const data: any = {};
    if (request.name !== undefined) data.name = request.name;
    if (request.currentHp !== undefined) data.currentHp = request.currentHp;
    if (request.maxHp !== undefined) data.maxHp = request.maxHp;
    if (request.tempHp !== undefined) data.tempHp = request.tempHp;
    if (request.ac !== undefined) data.ac = request.ac;
    if (request.initiative !== undefined) data.initiative = request.initiative;
    if (request.isActive !== undefined) data.isActive = request.isActive;

    return this.prisma.actor.update({
      where: { id },
      data,
      include: {
        monster: true,
        character: true,
      },
    });
  }

  async deleteActor(id: string) {
    return this.prisma.actor.delete({
      where: { id },
    });
  }

  async healActor(id: string, amount: number) {
    const actor = await this.getActor(id);
    if (!actor) {
      throw new Error("Actor not found");
    }

    const newHp = Math.min(actor.currentHp + amount, actor.maxHp);
    return this.updateActor(id, { currentHp: newHp });
  }

  async damageActor(id: string, amount: number) {
    const actor = await this.getActor(id);
    if (!actor) {
      throw new Error("Actor not found");
    }

    let newHp = actor.currentHp - amount;
    let newTempHp = actor.tempHp;

    // Apply damage to temp HP first
    if (newTempHp > 0) {
      const tempDamage = Math.min(amount, newTempHp);
      newTempHp -= tempDamage;
      amount -= tempDamage;
    }

    // Apply remaining damage to regular HP
    if (amount > 0) {
      newHp = Math.max(0, actor.currentHp - amount);
    } else {
      newHp = actor.currentHp;
    }

    return this.updateActor(id, { currentHp: newHp, tempHp: newTempHp });
  }

  async addTempHp(id: string, amount: number) {
    const actor = await this.getActor(id);
    if (!actor) {
      throw new Error("Actor not found");
    }

    // Temp HP doesn't stack - take the higher value
    const newTempHp = Math.max(actor.tempHp, amount);
    return this.updateActor(id, { tempHp: newTempHp });
  }

  async rollInitiative(id: string, roll: number) {
    return this.updateActor(id, { initiative: roll });
  }

  async getActorStats(campaignId: string) {
    const [total, byKind, activeCount] = await Promise.all([
      this.prisma.actor.count({ where: { campaignId } }),
      this.prisma.actor.groupBy({
        by: ["kind"],
        where: { campaignId },
        _count: true,
      }),
      this.prisma.actor.count({ where: { campaignId, isActive: true } }),
    ]);

    return {
      total,
      active: activeCount,
      byKind: byKind.reduce(
        (_acc, _group) => {
          acc[group.kind] = group._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
