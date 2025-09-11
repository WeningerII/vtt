import { execSync } from "child_process";
import { join } from "path";
import { existsSync, unlinkSync } from "fs";

class TestDatabase {
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
      const { PrismaClient } = await import("../../node_modules/.prisma/test-client/index.js");
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
    this.ensurePrisma();

    console.log("[Test DB] Resetting database state...");

    // Delete all data in reverse dependency order (using test schema models)
    await this.prisma!.auditLog.deleteMany();
    await this.prisma!.asset.deleteMany();
    await this.prisma!.gameParticipant.deleteMany();
    await this.prisma!.game.deleteMany();
    await this.prisma!.scene.deleteMany();
    await this.prisma!.session.deleteMany();
    await this.prisma!.user.deleteMany();

    console.log("[Test DB] Database reset complete");
  }

  async getClient(): Promise<any> {
    return this.ensurePrisma();
  }

  async seed(): Promise<void> {
    await this.ensurePrisma();

    console.log("[Test DB] Seeding test data...");

    // Ensure clean state before seeding
    await this.reset();

    // Create test users (using test schema fields)
    const gmUser = await this.prisma!.user.create({
      data: {
        email: "gm@test.com",
        username: "testgm",
        passwordHash: "hashedpassword",
      },
    });

    const playerUser = await this.prisma!.user.create({
      data: {
        email: "player@test.com",
        username: "testplayer",
        passwordHash: "hashedpassword",
      },
    });

    // Create test scene first
    const testScene = await this.prisma!.scene.create({
      data: {
        name: "Test Scene",
        description: "A test scene for E2E testing",
        ownerId: gmUser.id,
        width: 1000,
        height: 1000,
        gridSize: 50,
      },
    });

    // Create test game with valid scene reference
    const testGame = await this.prisma!.game.create({
      data: {
        name: "Test Game",
        sceneId: testScene.id,
      },
    });

    // Add users as game participants
    await this.prisma!.gameParticipant.create({
      data: {
        gameId: testGame.id,
        userId: gmUser.id,
        role: "GM",
      },
    });

    await this.prisma!.gameParticipant.create({
      data: {
        gameId: testGame.id,
        userId: playerUser.id,
        role: "PLAYER",
      },
    });

    console.log("[Test DB] Test data seeded successfully");
  }
}

// Provide both canonical and underscored exports for compatibility
const testDb = TestDatabase.getInstance();
const _testDb = testDb;

export { TestDatabase, testDb, _testDb };
