/**
 * Monster service for business logic and data operations
 * Full Prisma integration with SRD content support
 */

import { PrismaClient, Prisma, Monster } from "@prisma/client";
import { logger } from "@vtt/logging";
// Fallback SRD monsters data - will be replaced with proper @vtt/content-5e-srd import when available
const SRDMonsters = [
  {
    id: "srd-goblin",
    name: "Goblin",
    tags: ["GOBLINOID", "HUMANOID"],
  },
  {
    id: "srd-orc",
    name: "Orc",
    tags: ["HUMANOID"],
  },
  {
    id: "srd-skeleton",
    name: "Skeleton",
    tags: ["UNDEAD"],
  },
  {
    id: "srd-wolf",
    name: "Wolf",
    tags: ["BEAST"],
  },
];

export interface CreateMonsterRequest {
  name: string;
  stableId?: string;
  statblock: Prisma.InputJsonValue;
  tags?: string[];
}

export interface UpdateMonsterRequest {
  name?: string;
  statblock?: Prisma.InputJsonValue;
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

    logger.info(`Seeding ${SRDMonsters.length} SRD monsters...`);

    for (const srdMonster of SRDMonsters) {
      try {
        const existingMonster = await this.prisma.monster.findUnique({
          where: { stableId: srdMonster.id },
        });

        if (existingMonster) {
          // Update existing monster with latest SRD data
          await this.prisma.monster.update({
            where: { stableId: srdMonster.id },
            data: {
              name: srdMonster.name,
              statblock: srdMonster as Prisma.InputJsonValue,
              tags: (srdMonster.tags || []) as Prisma.JsonArray,
            },
          });
          updated++;
          logger.debug(`Updated SRD monster: ${srdMonster.name}`);
        } else {
          // Create new monster
          await this.prisma.monster.create({
            data: {
              stableId: srdMonster.id,
              name: srdMonster.name,
              statblock: srdMonster as Prisma.InputJsonValue,
              tags: (srdMonster.tags || []) as Prisma.JsonArray,
            },
          });
          created++;
          logger.debug(`Created SRD monster: ${srdMonster.name}`);
        }
      } catch (error) {
        const seedError = error instanceof Error ? error : new Error(String(error));
        logger.error(`Failed to process SRD monster ${srdMonster.name}:`, seedError);
      }
    }

    logger.info(`SRD monster seeding complete. Created: ${created}, Updated: ${updated}`);
    return { created, updated, total: SRDMonsters.length };
  }

  async searchMonsters(options: MonsterSearchOptions = {}) {
    const { query, tags, limit = 50, offset = 0 } = options;

    const whereClause: Prisma.MonsterWhereInput = {};

    // Text search in name
    if (query && query.trim()) {
      whereClause.name = {
        contains: query.trim(),
        mode: "insensitive",
      };
    }

    // Tag filtering
    if (tags && tags.length > 0) {
      whereClause.tags = {
        array_contains: tags as Prisma.JsonArray,
      };
    }

    try {
      const [monsters, totalCount] = await Promise.all([
        this.prisma.monster.findMany({
          where: whereClause,
          orderBy: { name: "asc" },
          skip: offset,
          take: limit,
          select: {
            id: true,
            stableId: true,
            name: true,
            tags: true,
            createdAt: true,
            updatedAt: true,
            statblock: true,
          },
        }),
        this.prisma.monster.count({ where: whereClause }),
      ]);

      return {
        monsters,
        totalCount,
        limit,
        offset,
        hasMore: totalCount > offset + monsters.length,
      };
    } catch (error) {
      const searchError = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to search monsters:", searchError);
      throw new Error("Monster search failed");
    }
  }

  async getMonster(idOrStableId: string): Promise<Monster | null> {
    try {
      // Try to find by regular ID first, then by stableId
      const monster = await this.prisma.monster.findFirst({
        where: {
          OR: [{ id: idOrStableId }, { stableId: idOrStableId }],
        },
      });

      return monster;
    } catch (error) {
      const getError = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to get monster ${idOrStableId}:`, getError);
      throw new Error("Failed to retrieve monster");
    }
  }

  async createMonster(request: CreateMonsterRequest) {
    try {
      // Validate unique stableId if provided
      if (request.stableId) {
        const existing = await this.prisma.monster.findUnique({
          where: { stableId: request.stableId },
        });
        if (existing) {
          throw new Error(`Monster with stableId '${request.stableId}' already exists`);
        }
      }

      const monster = await this.prisma.monster.create({
        data: {
          name: request.name,
          stableId: request.stableId || `custom-${Date.now()}`,
          statblock: request.statblock,
          tags: (request.tags || []) as Prisma.JsonArray,
        },
      });

      logger.info(`Created monster: ${monster.name} (${monster.id})`);
      return monster;
    } catch (error) {
      const createError = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to create monster:", createError);
      throw createError;
    }
  }

  async updateMonster(idOrStableId: string, request: UpdateMonsterRequest) {
    try {
      // Find the monster first
      const existingMonster = await this.getMonster(idOrStableId);
      if (!existingMonster) {
        throw new Error("Monster not found");
      }

      // Prepare update data
      const updateData: Prisma.MonsterUpdateInput = {};
      if (request.name !== undefined) {
        updateData.name = request.name;
      }
      if (request.statblock !== undefined) {
        updateData.statblock = request.statblock;
      }
      if (request.tags !== undefined) {
        updateData.tags = (request.tags ?? []) as Prisma.JsonArray;
      }

      const updatedMonster = await this.prisma.monster.update({
        where: { id: existingMonster.id },
        data: updateData,
      });

      logger.info(`Updated monster: ${updatedMonster.name} (${updatedMonster.id})`);
      return updatedMonster;
    } catch (error) {
      const updateError = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to update monster ${idOrStableId}:`, updateError);
      throw updateError;
    }
  }

  async deleteMonster(idOrStableId: string) {
    try {
      const existingMonster = await this.getMonster(idOrStableId);
      if (!existingMonster) {
        throw new Error("Monster not found");
      }

      await this.prisma.monster.delete({
        where: { id: existingMonster.id },
      });

      logger.info(`Deleted monster: ${existingMonster.name} (${existingMonster.id})`);
      return { success: true, message: `Monster '${existingMonster.name}' deleted successfully` };
    } catch (error) {
      const deleteError = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to delete monster ${idOrStableId}:`, deleteError);
      throw deleteError;
    }
  }

  async getMonsterStats() {
    try {
      const [totalCount, srdCount, tagStats] = await Promise.all([
        this.prisma.monster.count(),
        this.prisma.monster.count({
          where: {
            stableId: {
              startsWith: "srd-",
            },
          },
        }),
        // Get top 10 most common tags
        this.prisma.$queryRaw<Array<{ tag: string; count: bigint }>>`
          SELECT tag, COUNT(*) as count
          FROM (
            SELECT jsonb_array_elements_text(tags) as tag
            FROM "Monster"
          ) as tag_counts
          GROUP BY tag
          ORDER BY count DESC
          LIMIT 10
        `,
      ]);

      const customCount = totalCount - srdCount;

      return {
        totalCount,
        srdCount,
        customCount,
        topTags: tagStats.map((stat) => ({
          tag: stat.tag,
          count: Number(stat.count),
        })),
      };
    } catch (error) {
      const statsError = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to get monster stats:", statsError);
      throw new Error("Failed to retrieve monster statistics");
    }
  }
}
