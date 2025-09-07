/**
 * Monster service for business logic and data operations
 * Enhanced with intelligent caching for performance
 */

import { PrismaClient } from "@prisma/client";
import SRDMonsters from "@vtt/content-5e-srd";
import { cacheManager } from "../cache/CacheManager";

export interface CreateMonsterRequest {
  name: string;
  stableId?: string;
  statblock: any;
  tags?: string[];
}

export interface UpdateMonsterRequest {
  name?: string;
  statblock?: any;
  tags?: string[];
}

export interface MonsterSearchOptions {
  query?: string | undefined;
  tags?: string[] | undefined;
  limit?: number;
  offset?: number;
}

export class MonsterService {
  constructor(private prisma: PrismaClient) {}

  async seedSRDMonsters(): Promise<{ created: number; updated: number; total: number }> {
    let created = 0;
    let updated = 0;

    // Clear monster cache since we're doing bulk updates
    cacheManager.clearAll();

    // Use imported SRD monsters
    
    for (const monster of SRDMonsters) {
      const stableId = monster.id;
      const existedBefore = await this.prisma.monster.findUnique({
        where: { stableId },
      });

      await this.prisma.monster.upsert({
        where: { stableId },
        create: {
          stableId,
          name: monster.name,
          statblock: monster as any,
          tags: Array.isArray((monster as any).tags) ? (monster as any).tags : [],
        },
        update: {
          name: monster.name,
          statblock: monster as any,
          tags: Array.isArray((monster as any).tags) ? (monster as any).tags : [],
        },
      });

      if (existedBefore) {
        updated += 1;
      } else {
        created += 1;
      }
    }

    return { created, updated, total: SRDMonsters.length };
  }

  async searchMonsters(options: MonsterSearchOptions = {}) {
    const { query, tags, limit = 50, offset = 0 } = options;

    // Check cache first
    const cached = cacheManager.getMonsterList(query || '', tags, limit, offset);
    if (cached) {
      return cached;
    }

    const where: any = {};

    if (query || tags?.length) {
      where.OR = [];

      if (query) {
        where.OR.push(
          { name: { contains: query, mode: "insensitive" } },
          { stableId: { contains: query, mode: "insensitive" } },
        );
      }

      if (tags?.length) {
        where.OR.push({ tags: { hasSome: tags } });
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.monster.findMany({
        where,
        skip: offset,
        take: Math.min(limit, 200),
        orderBy: { name: "asc" },
      }),
      this.prisma.monster.count({ where }),
    ]);

    const result = { items, total, limit, offset };
    
    // Cache the result for future requests  
    cacheManager.setMonsterList(query || '', items, tags, limit, offset);
    
    return result;
  }

  async getMonster(idOrStableId: string): Promise<any | null> {
    // Check cache first
    const cached = cacheManager.getMonster(idOrStableId);
    if (cached) {
      return cached;
    }

    const monster = await this.prisma.monster.findFirst({
      where: {
        OR: [{ id: idOrStableId }, { stableId: idOrStableId }],
      },
    });

    // Cache the monster if found
    if (monster) {
      cacheManager.setMonster(monster.id, monster);
      // Also cache by stableId if different
      if (monster.stableId && monster.stableId !== monster.id) {
        cacheManager.setMonster(monster.stableId, monster);
      }
    }

    return monster;
  }

  async createMonster(request: CreateMonsterRequest) {
    const stableId = request.stableId || this.generateStableId(request.name);

    const monster = await this.prisma.monster.create({
      data: {
        name: request.name,
        stableId,
        statblock: request.statblock,
        tags: request.tags || [],
      },
    });

    // Cache the new monster
    cacheManager.setMonster(monster.id, monster);
    if (monster.stableId !== monster.id) {
      cacheManager.setMonster(monster.stableId, monster);
    }

    return monster;
  }

  async updateMonster(idOrStableId: string, request: UpdateMonsterRequest) {
    const monster = await this.getMonster(idOrStableId);
    if (!monster) {
      throw new Error("Monster not found");
    }

    const data: any = {};
    if (request.name !== undefined) {data.name = request.name;}
    if (request.statblock !== undefined) {data.statblock = request.statblock;}
    if (request.tags !== undefined) {data.tags = request.tags;}

    const updatedMonster = await this.prisma.monster.update({
      where: { id: monster.id },
      data,
    });

    // Invalidate and refresh cache
    cacheManager.invalidateMonster(monster.id);
    cacheManager.setMonster(updatedMonster.id, updatedMonster);
    if (updatedMonster.stableId !== updatedMonster.id) {
      cacheManager.setMonster(updatedMonster.stableId, updatedMonster);
    }

    return updatedMonster;
  }

  async deleteMonster(idOrStableId: string) {
    const monster = await this.getMonster(idOrStableId);
    if (!monster) {
      throw new Error("Monster not found");
    }

    const result = await this.prisma.monster.delete({
      where: { id: monster.id },
    });

    // Invalidate cache
    cacheManager.invalidateMonster(monster.id);
    if (monster.stableId !== monster.id) {
      cacheManager.invalidateMonster(monster.stableId);
    }

    return result;
  }

  private generateStableId(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    const suffix = Math.random().toString(36).slice(2, 6);
    return base ? `${base}-${suffix}` : `monster-${Date.now()}`;
  }

  async getMonsterStats() {
    const [total, byType] = await Promise.all([
      this.prisma.monster.count(),
      this.prisma.monster.groupBy({
        by: ["tags"],
        _count: true,
      }),
    ]);

    // Flatten tags for statistics
    const tagCounts: Record<string, number> = {};
    byType.forEach((group) => {
      if (group.tags && Array.isArray(group.tags)) {
        (group.tags as string[]).forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + group._count;
        });
      }
    });

    return {
      total,
      tagCounts,
      topTags: Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count })),
    };
  }
}
