/**
 * Monster service for business logic and data operations
 */

import { PrismaClient } from "@prisma/client";
import SRDMonsters from "@vtt/content-5e-srd";

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

    return { items, total, limit, offset };
  }

  async getMonster(idOrStableId: string) {
    return this.prisma.monster.findFirst({
      where: {
        OR: [{ id: idOrStableId }, { stableId: idOrStableId }],
      },
      include: {
        actors: {
          include: {
            tokens: true,
          },
        },
      },
    });
  }

  async createMonster(request: CreateMonsterRequest) {
    const stableId = request.stableId || this.generateStableId(request.name);

    return this.prisma.monster.create({
      data: {
        name: request.name,
        stableId,
        statblock: request.statblock,
        tags: request.tags || [],
      },
    });
  }

  async updateMonster(idOrStableId: string, request: UpdateMonsterRequest) {
    const monster = await this.getMonster(idOrStableId);
    if (!monster) {
      throw new Error("Monster not found");
    }

    const data: any = {};
    if (request.name !== undefined) data.name = request.name;
    if (request.statblock !== undefined) data.statblock = request.statblock;
    if (request.tags !== undefined) data.tags = request.tags;

    return this.prisma.monster.update({
      where: { id: monster.id },
      data,
    });
  }

  async deleteMonster(idOrStableId: string) {
    const monster = await this.getMonster(idOrStableId);
    if (!monster) {
      throw new Error("Monster not found");
    }

    return this.prisma.monster.delete({
      where: { id: monster.id },
    });
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
      group.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + group._count;
      });
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
