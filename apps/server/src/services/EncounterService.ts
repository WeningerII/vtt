/**
 * Encounter service for business logic and combat flow
 */

import { PrismaClient } from "@prisma/client";

export interface CreateEncounterRequest {
  name: string;
  campaignId: string; // This will be mapped to gameSessionId
  description?: string;
}

export interface AddParticipantRequest {
  actorId: string;
  initiative: number;
}

export interface EncounterSearchOptions {
  gameSessionId: string;
  status?: string; // 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
  limit?: number;
  offset?: number;
}

export class EncounterService {
  constructor(private prisma: PrismaClient) {}

  async searchEncounters(options: EncounterSearchOptions) {
    const { gameSessionId, status, limit = 50, offset = 0 } = options;

    const where: any = { gameSessionId };
    if (status !== undefined) {where.status = status;}

    const [items, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where,
        skip: offset,
        take: Math.min(limit, 200),
        orderBy: { createdAt: "desc" },
        include: {
          encounterTokens: {
            include: {
              token: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  initiative: true,
                  health: true,
                  maxHealth: true
                }
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
        encounterTokens: {
          include: {
            token: {
              select: {
                id: true,
                name: true,
                type: true,
                initiative: true,
                health: true,
                maxHealth: true,
                x: true,
                y: true
              }
            },
          },
          orderBy: { initiative: "desc" },
        },
        gameSession: {
          select: {
            id: true,
            name: true,
            campaignId: true
          }
        }
      },
    });
  }

  async createEncounter(request: CreateEncounterRequest) {
    return this.prisma.encounter.create({
      data: {
        name: request.name,
        gameSessionId: request.campaignId, // Note: This might need to be actual gameSessionId
        roundNumber: 1,
        currentTurn: 0,
        status: 'PLANNED',
      },
      include: {
        encounterTokens: {
          include: {
            token: true,
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

    // Check if participant already exists
    const existing = await this.prisma.encounterToken.findFirst({
      where: {
        encounterId,
        tokenId: request.actorId,
      },
    });
    if (existing) {
      throw new Error("Token already participating in encounter");
    }

    const participant = await this.prisma.encounterToken.create({
      data: {
        encounterId,
        tokenId: request.actorId,
        initiative: request.initiative,
      },
      include: {
        token: true,
      },
    });

    return participant;
  }

  async removeParticipant(encounterId: string, participantId: string) {
    await this.prisma.encounterToken.delete({
      where: {
        id: participantId,
        encounterId,
      },
    });

    return true;
  }

  async startEncounter(id: string) {
    const encounter = await this.prisma.encounter.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        startedAt: new Date(),
        roundNumber: 1,
        currentTurn: 0,
      },
    });

    return encounter;
  }

  async nextTurn(id: string) {
    const encounter = await this.getEncounter(id);
    if (!encounter || encounter.status !== 'ACTIVE') {
      throw new Error("Encounter not found or not active");
    }

    const participantCount = encounter.encounterTokens.length;
    let nextTurn = encounter.currentTurn + 1;
    let nextRound = encounter.roundNumber;

    if (nextTurn >= participantCount) {
      nextTurn = 0;
      nextRound += 1;
    }

    return this.prisma.encounter.update({
      where: { id },
      data: {
        currentTurn: nextTurn,
        roundNumber: nextRound,
      },
    });
  }

  async endEncounter(id: string) {
    const encounter = await this.prisma.encounter.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
      },
    });

    return encounter;
  }

  async deleteEncounter(id: string) {
    return this.prisma.encounter.delete({
      where: { id },
    });
  }

  async getCurrentParticipant(id: string) {
    const encounter = await this.getEncounter(id);
    if (!encounter || encounter.status !== 'ACTIVE') {
      return null;
    }

    const participantCount = encounter.encounterTokens.length;
    if (participantCount === 0 || encounter.currentTurn >= participantCount) {
      return null;
    }

    return encounter.encounterTokens[encounter.currentTurn];
  }

  async markParticipantActed(encounterId: string, tokenId: string, hasActed: boolean = true) {
    // Note: EncounterToken schema doesn't have hasActed field
    // This could be implemented using metadata or separate tracking
    return this.prisma.encounterToken.update({
      where: {
        id: tokenId,
        encounterId,
      },
      data: { isActive: hasActed },
    });
  }

  async setParticipantActive(encounterId: string, tokenId: string, isActive: boolean) {
    return this.prisma.encounterToken.update({
      where: {
        id: tokenId,
        encounterId,
      },
      data: { isActive },
    });
  }

  async updateInitiative(encounterId: string, tokenId: string, initiative: number) {
    return this.prisma.encounterToken.update({
      where: {
        id: tokenId,
        encounterId,
      },
      data: { initiative },
    });
  }

  async rollInitiativeForAll(encounterId: string) {
    const participants = await this.prisma.encounterToken.findMany({
      where: { encounterId },
      include: {
        token: true,
      },
    });

    const updates = participants.map(async (participant) => {
      // Roll d20 + dex modifier (simplified from token data)
      let dexMod = 0;
      if (participant.token && participant.token.metadata) {
        const metadata = participant.token.metadata as any;
        const dex = metadata?.abilities?.DEX || 10;
        dexMod = Math.floor((dex - 10) / 2);
      }

      const roll = Math.floor(Math.random() * 20) + 1 + dexMod;

      return this.updateInitiative(encounterId, participant.id, roll);
    });

    await Promise.all(updates);
    return this.getEncounter(encounterId);
  }

  async getEncounterStats(gameSessionId: string) {
    const [activeCount, totalCount, avgRounds] = await Promise.all([
      this.prisma.encounter.count({
        where: { gameSessionId, status: 'ACTIVE' },
      }),
      this.prisma.encounter.count({
        where: { gameSessionId },
      }),
      this.prisma.encounter.aggregate({
        where: { gameSessionId, status: 'COMPLETED' },
        _avg: { roundNumber: true },
      }),
    ]);

    return {
      active: activeCount,
      total: totalCount,
      averageRounds: avgRounds._avg.roundNumber || 0,
    };
  }
}
