import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';

export class TestDatabase {
  private static instance: TestDatabase;
  private prisma: PrismaClient | null = null;
  private readonly testDbPath = join(process.cwd(), 'test.db');

  static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  /**
   * Ensure a PrismaClient is available for the current process.
   * This allows each Playwright worker to lazily initialize its own
   * client against the same SQLite test database file.
   */
  private ensurePrisma(): PrismaClient {
    if (!this.prisma) {
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: 'file:./test.db',
          },
        },
      });
      // $connect is optional; Prisma will connect on first query if omitted
    }
    return this.prisma;
  }

  async setup(): Promise<void> {
    console.log('[Test DB] Setting up test database...');
    
    // Remove existing test database
    await this.cleanup();
    
    // Push schema to test database using main schema but test DB
    execSync('pnpm dlx prisma db push --schema apps/server/prisma/schema.prisma', {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    });
    
    // Initialize Prisma client with test database URL
    this.ensurePrisma();
    await this.prisma!.$connect();
    console.log('[Test DB] Database setup complete');
  }

  async cleanup(): Promise<void> {
    console.log('[Test DB] Cleaning up test database...');
    
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
    
    // Remove test database file
    if (existsSync(this.testDbPath)) {
      unlinkSync(this.testDbPath);
    }
    
    console.log('[Test DB] Database cleanup complete');
  }

  async reset(): Promise<void> {
    this.ensurePrisma();
    
    console.log('[Test DB] Resetting database state...');
    
    // Delete all data in reverse dependency order
    await this.prisma!.appliedCondition.deleteMany();
    await this.prisma!.encounterParticipant.deleteMany();
    await this.prisma!.encounter.deleteMany();
    await this.prisma!.token.deleteMany();
    await this.prisma!.actor.deleteMany();
    await this.prisma!.scene.deleteMany();
    await this.prisma!.campaignMember.deleteMany();
    await this.prisma!.campaign.deleteMany();
    await this.prisma!.asset.deleteMany();
    await this.prisma!.generationJob.deleteMany();
    await this.prisma!.map.deleteMany();
    await this.prisma!.chatMessage.deleteMany();
    await this.prisma!.user.deleteMany();
    
    console.log('[Test DB] Database reset complete');
  }

  getClient(): PrismaClient {
    return this.ensurePrisma();
  }

  async seed(): Promise<void> {
    this.ensurePrisma();
    
    console.log('[Test DB] Seeding test data...');
    
    // Create test users (using actual schema fields)
    const gmUser = await this.prisma!.user.create({
      data: {
        displayName: 'Test GM',
      },
    });

    const playerUser = await this.prisma!.user.create({
      data: {
        displayName: 'Test Player',
      },
    });

    // Create test map
    const testMap = await this.prisma!.map.create({
      data: {
        name: 'Test Map',
        widthPx: 1000,
        heightPx: 800,
        gridSizePx: 50,
      },
    });

    // Create test campaign
    const testCampaign = await this.prisma!.campaign.create({
      data: {
        name: 'Test Campaign',
        description: 'A test campaign for e2e testing',
        gameSystem: 'dnd5e',
        isActive: true,
      },
    });

    // Add campaign members
    await this.prisma!.campaignMember.createMany({
      data: [
        {
          userId: gmUser.id,
          campaignId: testCampaign.id,
          role: 'gm',
        },
        {
          userId: playerUser.id,
          campaignId: testCampaign.id,
          role: 'player',
        },
      ],
    });

    // Create test scene
    const testScene = await this.prisma!.scene.create({
      data: {
        name: 'Test Scene',
        campaignId: testCampaign.id,
        mapId: testMap.id,
        gridSettings: '{"size": 50, "type": "square"}',
        lightingSettings: '{"globalLight": true}',
        fogSettings: '{"enabled": false}',
      },
    });

    // Create test actor
    const testActor = await this.prisma!.actor.create({
      data: {
        name: 'Test Character',
        kind: 'PC',
        userId: playerUser.id,
        campaignId: testCampaign.id,
        currentHp: 25,
        maxHp: 25,
        ac: 15,
        initiative: 12,
      },
    });

    // Create test token
    await this.prisma!.token.create({
      data: {
        name: 'Test Token',
        sceneId: testScene.id,
        actorId: testActor.id,
        x: 100,
        y: 100,
        width: 1,
        height: 1,
        disposition: 'FRIENDLY',
        isVisible: true,
      },
    });

    console.log('[Test DB] Test data seeded successfully');
  }
}

// Provide both canonical and underscored exports for compatibility
export const testDb = TestDatabase.getInstance();
export const _testDb = testDb;
