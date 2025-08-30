/**
 * Encounter service for business logic and combat flow
 */

import { PrismaClient } from "@prisma/client";

export interface CreateEncounterRequest {
  name: string;
  campaignId: string;
  description?: string;
}

export interface AddParticipantRequest {
  actorId: string;
  initiative: number;
}

export interface EncounterSearchOptions {
  campaignId: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export class EncounterService {
  constructor(private prisma: PrismaClient) {}

  async searchEncounters(options: EncounterSearchOptions) {
    const { campaignId,  isActive,  limit = 50,  offset = 0  } = options;

    const where: any = { campaignId };
    if (isActive !== undefined) where.isActive = isActive;

    const [items, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where,
        skip: offset,
        take: Math.min(limit, 200),
        orderBy: { createdAt: "desc" },
        include: {
          participants: {
            include: {
              actor: {
                include: {
                  monster: true,
                  character: true,
                },
              },
            },
            orderBy: { initiative: "desc" },
          },
        },
      }),
      this.prisma.encounter.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getEncounter(id: string) {
    return this.prisma.encounter.findUnique({
      where: { id },
      include: {
        participants: {
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
            appliedConditions: {
              include: {
                condition: true,
              },
            },
          },
          orderBy: { initiative: "desc" },
        },
      },
    });
  }

  async createEncounter(request: CreateEncounterRequest) {
    return this.prisma.encounter.create({
      data: {
        name: request.name,
        campaignId: request.campaignId,
        description: request.description || "",
        currentRound: 0,
        currentTurn: 0,
        isActive: false,
      },
      include: {
        participants: {
          include: {
            actor: {
              include: {
                monster: true,
                character: true,
              },
            },
          },
          orderBy: { initiative: "desc" },
        },
      },
    });
  }

  async addParticipant(encounterId: string, request: AddParticipantRequest) {
    // Validate encounter exists
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
    });
    if (!encounter) {
      throw new Error("Encounter not found");
    }

    // Validate actor exists
    const actor = await this.prisma.actor.findUnique({
      where: { id: request.actorId },
    });
    if (!actor) {
      throw new Error("Actor not found");
    }

    // Check if participant already exists
    const existing = await this.prisma.encounterParticipant.findUnique({
      where: {
        encounterId_actorId: {
          encounterId,
          actorId: request.actorId,
        },
      },
    });

    if (existing) {
      throw new Error("Actor already in encounter");
    }

    return this.prisma.encounterParticipant.create({
      data: {
        encounterId,
        actorId: request.actorId,
        initiative: request.initiative,
        isActive: true,
        hasActed: false,
      },
      include: {
        actor: {
          include: {
            monster: true,
            character: true,
          },
        },
      },
    });
  }

  async removeParticipant(encounterId: string, actorId: string) {
    return this.prisma.encounterParticipant.delete({
      where: {
        encounterId_actorId: {
          encounterId,
          actorId,
        },
      },
    });
  }

  async startEncounter(id: string) {
    // Check if encounter has participants
    const participantCount = await this.prisma.encounterParticipant.count({
      where: { encounterId: id },
    });

    if (participantCount === 0) {
      throw new Error("Cannot start encounter without participants");
    }

    // Reset all participants' hasActed flag
    await this.prisma.encounterParticipant.updateMany({
      where: { encounterId: id },
      data: { hasActed: false },
    });

    return this.prisma.encounter.update({
      where: { id },
      data: {
        isActive: true,
        currentRound: 1,
        currentTurn: 0,
      },
      include: {
        participants: {
          include: {
            actor: {
              include: {
                monster: true,
                character: true,
              },
            },
          },
          orderBy: { initiative: "desc" },
        },
      },
    });
  }

  async nextTurn(id: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
      include: {
        participants: {
          where: { isActive: true },
          orderBy: { initiative: "desc" },
        },
      },
    });

    if (!encounter) {
      throw new Error("Encounter not found");
    }

    if (!encounter.isActive) {
      throw new Error("Encounter is not active");
    }

    const participants = encounter.participants;
    if (participants.length === 0) {
      throw new Error("No active participants");
    }

    let newTurn = encounter.currentTurn + 1;
    let newRound = encounter.currentRound;

    // If we've gone through all participants, start new round
    if (newTurn >= participants.length) {
      newTurn = 0;
      newRound += 1;
      
      // Reset hasActed for all participants at start of new round
      await this.prisma.encounterParticipant.updateMany({
        where: { encounterId: id },
        data: { hasActed: false },
      });
    }

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        currentTurn: newTurn,
        currentRound: newRound,
      },
      include: {
        participants: {
          include: {
            actor: {
              include: {
                monster: true,
                character: true,
              },
            },
          },
          orderBy: { initiative: "desc" },
        },
      },
    });

    return {
      encounter: updated,
      currentParticipant: participants[newTurn] || null,
    };
  }

  async endEncounter(id: string) {
    return this.prisma.encounter.update({
      where: { id },
      data: {
        isActive: false,
      },
      include: {
        participants: {
          include: {
            actor: {
              include: {
                monster: true,
                character: true,
              },
            },
          },
          orderBy: { initiative: "desc" },
        },
      },
    });
  }

  async deleteEncounter(id: string) {
    return this.prisma.encounter.delete({
      where: { id },
    });
  }

  async getCurrentParticipant(id: string) {
    const encounter = await this.getEncounter(id);
    if (!encounter || !encounter.isActive) {
      return null;
    }

    const participants = encounter.participants.filter(p => p.isActive);
    if (participants.length === 0 || encounter.currentTurn >= participants.length) {
      return null;
    }

    return participants[encounter.currentTurn];
  }

  async markParticipantActed(encounterId: string, actorId: string, hasActed: boolean = true) {
    return this.prisma.encounterParticipant.update({
      where: {
        encounterId_actorId: {
          encounterId,
          actorId,
        },
      },
      data: { hasActed },
    });
  }

  async setParticipantActive(encounterId: string, actorId: string, isActive: boolean) {
    return this.prisma.encounterParticipant.update({
      where: {
        encounterId_actorId: {
          encounterId,
          actorId,
        },
      },
      data: { isActive },
    });
  }

  async updateInitiative(encounterId: string, actorId: string, initiative: number) {
    return this.prisma.encounterParticipant.update({
      where: {
        encounterId_actorId: {
          encounterId,
          actorId,
        },
      },
      data: { initiative },
    });
  }

  async rollInitiativeForAll(encounterId: string) {
    const participants = await this.prisma.encounterParticipant.findMany({
      where: { encounterId },
      include: {
        actor: {
          include: {
            monster: true,
          },
        },
      },
    });

    const updates = participants.map(async (participant) => {
      // Roll d20 + dex modifier (simplified)
      let dexMod = 0;
      if (participant.actor.monster?.statblock) {
        const statblock = participant.actor.monster.statblock as any;
        const dex = statblock.abilities?.DEX || 10;
        dexMod = Math.floor((dex - 10) / 2);
      }

      const roll = Math.floor(Math.random() * 20) + 1 + dexMod;
      
      return this.updateInitiative(encounterId, participant.actorId, roll);
    });

    await Promise.all(updates);
    return this.getEncounter(encounterId);
  }

  async getEncounterStats(campaignId: string) {
    const [total, active, avgRounds] = await Promise.all([
      this.prisma.encounter.count({ where: { campaignId } }),
      this.prisma.encounter.count({ where: { campaignId, isActive: true } }),
      this.prisma.encounter.aggregate({
        where: { campaignId, isActive: false },
        _avg: { currentRound: true },
      }),
    ]);

    return {
      total,
      active,
      averageRounds: avgRounds._avg.currentRound || 0,
    };
  }
}
