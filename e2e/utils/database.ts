import { execSync } from "child_process";
import { join } from "path";
import { existsSync, unlinkSync } from "fs";
import { pathToFileURL } from "url";

// Helper to determine if DB operations should be skipped
const shouldSkipDb = (): boolean => {
  const skip = process.env.E2E_SKIP_DB;
  const skipSetup = process.env.E2E_SKIP_DB_SETUP;
  return skip === "1" || skip === "true" || skipSetup === "1" || skipSetup === "true";
};

export class TestDatabase {
  private static instance: TestDatabase;
  private prisma: any | null = null;
  private readonly testDbPath = join(process.cwd(), "test.db");

  static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  /**
   * Ensure the Prisma test client exists and can be imported.
   */
  private ensureGeneratedClient() {
    const clientEntry = join(process.cwd(), "node_modules", ".prisma", "test-client", "index.js");
    if (!existsSync(clientEntry)) {
      console.log("[Test DB] Generating Prisma test client...");
      execSync("pnpm dlx prisma generate --schema apps/server/prisma/schema.test.prisma", {
        stdio: "inherit",
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: "file:./test.db" },
      });
    }
  }

  /**
   * Ensure a PrismaClient is available for the current process.
   * This allows each Playwright worker to lazily initialize its own
   * client against the same SQLite test database file.
   */
  private async ensurePrisma(): Promise<any> {
    if (!this.prisma) {
      this.ensureGeneratedClient();
      const clientModulePath = join(
        process.cwd(),
        "node_modules",
        ".prisma",
        "test-client",
        "index.js",
      );
      const { PrismaClient } = await import(pathToFileURL(clientModulePath).href);
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: "file:./test.db",
          },
        },
      });
      // $connect is optional; Prisma will connect on first query if omitted
    }
    return this.prisma;
  }

  async setup(): Promise<void> {
    if (shouldSkipDb()) {
      console.log("[Test DB] Skipping setup due to E2E_SKIP_DB");
      return;
    }
    console.log("[Test DB] Setting up test database...");

    // Remove existing test database
    await this.cleanup();

    // Ensure client is generated before pushing schema
    this.ensureGeneratedClient();

    // Push schema to test database using test schema
    execSync("pnpm dlx prisma db push --schema apps/server/prisma/schema.test.prisma", {
      stdio: "inherit",
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: "file:./test.db" },
    });

    // Initialize Prisma client with test database URL
    await this.ensurePrisma();
    await this.prisma!.$connect();
    console.log("[Test DB] Database setup complete");
  }

  async cleanup(): Promise<void> {
    if (shouldSkipDb()) {
      console.log("[Test DB] Skipping cleanup due to E2E_SKIP_DB");
      return;
    }
    console.log("[Test DB] Cleaning up test database...");

    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }

    // Remove test database file
    if (existsSync(this.testDbPath)) {
      unlinkSync(this.testDbPath);
    }

    console.log("[Test DB] Database cleanup complete");
  }

  async reset(): Promise<void> {
    if (shouldSkipDb()) {
      console.log("[Test DB] Skipping reset due to E2E_SKIP_DB");
      return;
    }

    await this.ensurePrisma();
    console.log("[Test DB] Resetting database state...");

    const runDeletes = async () => {
      // Delete all data in reverse dependency order (production-mirrored test schema)
      await this.prisma!.encounterToken.deleteMany();
      await this.prisma!.encounter.deleteMany();
      await this.prisma!.token.deleteMany();
      await this.prisma!.gameSession.deleteMany();
      await this.prisma!.campaignCharacter.deleteMany();
      await this.prisma!.character.deleteMany();
      await this.prisma!.chatMessage.deleteMany();
      await this.prisma!.campaignSettings.deleteMany();
      await this.prisma!.campaignMember.deleteMany();
      await this.prisma!.scene.deleteMany();
      await this.prisma!.campaign.deleteMany();
      await this.prisma!.refreshToken.deleteMany();
      await this.prisma!.providerCall.deleteMany();
      await this.prisma!.generationJob.deleteMany();
      await this.prisma!.asset.deleteMany();
      await this.prisma!.appliedCondition.deleteMany();
      await this.prisma!.condition.deleteMany();
      await this.prisma!.monster.deleteMany();
      await this.prisma!.map.deleteMany();
      await this.prisma!.user.deleteMany();
    };

    try {
      await runDeletes();
    } catch (error) {
      console.warn("[Test DB] Reset failed; attempting setup then retry...", error);
      await this.setup();
      await this.ensurePrisma();
      await runDeletes();
    }

    console.log("[Test DB] Database reset complete");
  }

  async getClient(): Promise<any> {
    if (shouldSkipDb()) {
      throw new Error("[Test DB] E2E_SKIP_DB is set; database operations are disabled.");
    }
    return this.ensurePrisma();
  }

  async seed(): Promise<void> {
    if (shouldSkipDb()) {
      console.log("[Test DB] Skipping seed due to E2E_SKIP_DB");
      return;
    }
    await this.ensurePrisma();

    console.log("[Test DB] Seeding test data...");

    // Ensure clean state before seeding
    await this.reset();

    // Create minimal seed data consistent with production-mirrored schema
    const gmUser = await this.prisma!.user.create({
      data: {
        email: "gm@test.com",
        username: "testgm",
        displayName: "Test GM",
        passwordHash: "hashedpassword",
        role: "GM",
      },
    });

    const playerUser = await this.prisma!.user.create({
      data: {
        email: "player@test.com",
        username: "testplayer",
        displayName: "Test Player",
        passwordHash: "hashedpassword",
        role: "player",
      },
    });

    const campaign = await this.prisma!.campaign.create({
      data: {
        name: "Seed Campaign",
        members: {
          create: [
            { userId: gmUser.id, role: "GM", status: "active" },
            { userId: playerUser.id, role: "player", status: "active" },
          ],
        },
        settings: {
          create: {
            description: "Seed campaign settings",
            gameSystem: "dnd5e",
            isActive: true,
          },
        },
      },
    });

    const scene = await this.prisma!.scene.create({
      data: {
        name: "Seed Scene",
        campaignId: campaign.id,
      },
    });

    await this.prisma!.campaign.update({
      where: { id: campaign.id },
      data: { activeSceneId: scene.id },
    });

    await this.prisma!.gameSession.create({
      data: {
        name: "Seed Session",
        campaignId: campaign.id,
        status: "WAITING",
        currentSceneId: scene.id,
      },
    });

    console.log("[Test DB] Test data seeded successfully");
  }
}

// Provide both canonical and underscored exports for compatibility
export const testDb = TestDatabase.getInstance();
export const _testDb = testDb;
export default testDb;
