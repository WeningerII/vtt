/**
 * Condition service for business logic and status effect management
 * Provides full CRUD operations and condition tracking for VTT entities
 */

import { PrismaClient } from "@prisma/client";

// Define types matching the Prisma schema
type ConditionType = 'BUFF' | 'DEBUFF' | 'NEUTRAL';

interface Condition {
  id: string;
  name: string;
  type: ConditionType;
  description: string;
  duration: number | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface AppliedCondition {
  id: string;
  conditionId: string;
  targetId: string;
  targetType: string;
  duration: number | null;
  metadata: Record<string, unknown>;
  appliedBy: string | null;
  appliedAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
  condition?: Condition;
}

// Re-export types for convenience
export type { Condition, AppliedCondition, ConditionType };

export interface CreateConditionRequest {
  name: string;
  type: ConditionType;
  description?: string;
  duration?: number;
  metadata?: any;
}

export interface UpdateConditionRequest {
  name?: string;
  type?: ConditionType;
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
  type?: ConditionType | undefined;
  limit?: number;
  offset?: number;
}

export interface ConditionSearchResult {
  items: Condition[];
  total: number;
  offset: number;
  limit: number;
}

export class ConditionService {
  constructor(private prisma: PrismaClient) {}

  // Access Prisma models directly - they're generated after schema compilation

  async searchConditions(options: ConditionSearchOptions): Promise<ConditionSearchResult> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    const where = options.type ? { type: options.type } : {};
    
    const [items, total] = await Promise.all([
      this.prisma.condition.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.condition.count({ where })
    ]);
    
    return { items, total, offset, limit };
  }

  async getCondition(id: string) {
    return await this.prisma.condition.findUnique({
      where: { id },
      include: {
        appliedConditions: {
          where: { isActive: true }
        }
      }
    });
  }

  async createCondition(request: CreateConditionRequest) {
    return await this.prisma.condition.create({
      data: {
        name: request.name,
        type: request.type,
        description: request.description || "",
        duration: request.duration,
        metadata: request.metadata
      }
    });
  }

  async updateCondition(id: string, request: UpdateConditionRequest) {
    const updateData: any = {};
    if (request.name !== undefined) {updateData.name = request.name;}
    if (request.type !== undefined) {updateData.type = request.type;}
    if (request.description !== undefined) {updateData.description = request.description;}
    if (request.duration !== undefined) {updateData.duration = request.duration;}
    if (request.metadata !== undefined) {updateData.metadata = request.metadata;}
    
    return await this.prisma.condition.update({
      where: { id },
      data: updateData
    });
  }

  async deleteCondition(id: string) {
    const deleted = await this.prisma.condition.delete({ where: { id } });
    return true;
  }

  async applyCondition(targetId: string, targetType: string, request: ApplyConditionRequest) {
    // Get the base condition to calculate expiration
    const condition = await this.prisma.condition.findUnique({
      where: { id: request.conditionId }
    });
    
    if (!condition) {
      throw new Error('Condition not found');
    }
    
    const duration = request.duration ?? condition.duration;
    const expiresAt = duration ? new Date(Date.now() + duration * 60000) : null; // Convert rounds to milliseconds
    
    return await this.prisma.appliedCondition.create({
      data: {
        conditionId: request.conditionId,
        targetId,
        targetType,
        duration,
        metadata: request.metadata,
        appliedBy: request.appliedBy,
        expiresAt,
        isActive: true
      },
      include: {
        condition: true
      }
    });
  }

  async removeCondition(appliedConditionId: string) {
    try {
      await this.prisma.appliedCondition.delete({
        where: { id: appliedConditionId }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getAppliedConditions(targetId: string, targetType?: string) {
    const where: any = {
      targetId,
      isActive: true
    };
    
    if (targetType) {
      where.targetType = targetType;
    }
    
    return await this.prisma.appliedCondition.findMany({
      where,
      include: {
        condition: true
      },
      orderBy: { appliedAt: 'desc' }
    });
  }

  async updateAppliedCondition(id: string, updates: unknown) {
    return await this.prisma.appliedCondition.update({
      where: { id },
      data: updates,
      include: {
        condition: true
      }
    });
  }

  async processExpiredConditions() {
    const expiredConditions = await this.prisma.appliedCondition.findMany({
      where: {
        isActive: true,
        expiresAt: {
          lte: new Date()
        }
      },
      include: {
        condition: true
      }
    });
    
    if (expiredConditions.length > 0) {
      await this.prisma.appliedCondition.deleteMany({
        where: {
          id: {
            in: expiredConditions.map(c => c.id)
          }
        }
      });
    }
    
    return expiredConditions;
  }

  async getConditionsByTarget(targetId: string) {
    return await this.getAppliedConditions(targetId);
  }

  async bulkRemoveConditions(targetIds: string[]) {
    const deleted = await this.prisma.appliedCondition.deleteMany({
      where: {
        targetId: {
          in: targetIds
        },
        isActive: true
      }
    });
    
    return { removed: deleted.count };
  }

  // Additional methods for compatibility
  async addConditionToEncounterParticipant(participantId: string, request: ApplyConditionRequest) {
    return await this.applyCondition(participantId, 'encounterParticipant', request);
  }

  async removeAppliedCondition(appliedConditionId: string) {
    return await this.removeCondition(appliedConditionId);
  }

  async getAppliedCondition(id: string) {
    return await this.prisma.appliedCondition.findUnique({
      where: { id },
      include: {
        condition: true
      }
    });
  }

  async getActiveConditions(targetId: string, targetType?: string) {
    return await this.getAppliedConditions(targetId, targetType);
  }

  async getActorConditions(actorId: string) {
    return await this.getAppliedConditions(actorId, 'actor');
  }

  async getTokenConditions(tokenId: string) {
    return await this.getAppliedConditions(tokenId, 'token');
  }

  async getEncounterParticipantConditions(participantId: string) {
    return await this.getAppliedConditions(participantId, 'encounterParticipant');
  }

  async getConditionStats() {
    const total = await this.prisma.condition.count();
    const active = await this.prisma.appliedCondition.count({
      where: { isActive: true }
    });
    const byTypeResults = await this.prisma.condition.groupBy({
      by: ['type'],
      _count: { type: true }
    });
    
    const byType = byTypeResults.reduce((acc, result) => {
      acc[result.type] = result._count.type;
      return acc;
    }, {} as Record<string, number>);
    
    return { total, active, byType };
  }

  async cleanupExpiredConditions() {
    return await this.processExpiredConditions();
  }

  async advanceConditionsOneRound(targetIds: string[], targetType: string = 'token') {
    const conditionsToAdvance = await this.prisma.appliedCondition.findMany({
      where: {
        targetId: { in: targetIds },
        targetType,
        isActive: true
      },
      include: {
        condition: true
      }
    });
    
    const updates: Promise<any>[] = [];
    
    for (const appliedCondition of conditionsToAdvance) {
      if (appliedCondition.duration && appliedCondition.duration > 0) {
        const newDuration = appliedCondition.duration - 1;
        
        if (newDuration <= 0) {
          // Condition expires
          updates.push(
            this.prisma.appliedCondition.update({
              where: { id: appliedCondition.id },
              data: { isActive: false, duration: 0 }
            }) as Promise<any>
          );
        } else {
          // Reduce duration
          updates.push(
            this.prisma.appliedCondition.update({
              where: { id: appliedCondition.id },
              data: { duration: newDuration }
            }) as Promise<any>
          );
        }
      }
    }
    
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    
    // Return the updated conditions
    return await this.prisma.appliedCondition.findMany({
      where: {
        targetId: { in: targetIds },
        targetType,
        isActive: true
      },
      include: {
        condition: true
      }
    });
  }
}
