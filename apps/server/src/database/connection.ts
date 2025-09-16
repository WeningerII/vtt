import path from "path";
import { PrismaClient as DefaultPrismaClient } from "@prisma/client";
import { logger } from "@vtt/logging";

class DatabaseManager {
  private static instance: any;
  private static isConnected = false;
  private static prismaCtor: any | null = null;

  private static resolvePrismaCtor(): any {
    if (DatabaseManager.prismaCtor) {return DatabaseManager.prismaCtor;}

    const dbUrl = process.env.DATABASE_URL || "";
    const isFileDb = dbUrl.startsWith("file:");

    if (isFileDb) {
      // Prefer the test client when using a SQLite file DB for E2E
      try {
        const testClientPath = path.resolve(process.cwd(), "node_modules/.prisma/test-client/index.js");
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(testClientPath);
        DatabaseManager.prismaCtor = mod.PrismaClient;
        logger.info("[db] Using Prisma test client for SQLite DB");
        return DatabaseManager.prismaCtor;
      } catch (e) {
        logger.warn("[db] Prisma test client not found; falling back to default client", (e as any)?.message || e);
      }
    }

    DatabaseManager.prismaCtor = DefaultPrismaClient as any;
    return DatabaseManager.prismaCtor;
  }

  static getInstance(): any {
    if (!DatabaseManager.instance) {
      try {
        const PrismaCtor = DatabaseManager.resolvePrismaCtor();
        DatabaseManager.instance = new PrismaCtor({
          log:
            process.env.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : ["error"],
          ...(process.env.DATABASE_URL && {
            datasources: {
              db: {
                url: process.env.DATABASE_URL,
              },
            },
          }),
        });
      } catch (error) {
        console.warn('Prisma client initialization failed, using mock client:', error);
        // Return a mock client that won't crash the server
        DatabaseManager.instance = {
          $connect: () => Promise.resolve(),
          $disconnect: () => Promise.resolve(),
          user: { findFirst: () => null, create: () => null, findUnique: () => null },
          map: { findMany: () => [], create: () => null },
          // Add other mock methods as needed
        };
      }
    }
    return DatabaseManager.instance;
  }

  static async connect(): Promise<void> {
    if (DatabaseManager.isConnected) {return;}

    try {
      const prisma = DatabaseManager.getInstance();
      await prisma.$connect();
      DatabaseManager.isConnected = true;
      logger.info("[db] Connected to database");
    } catch (error) {
      logger.error("[db] Failed to connect:", error as any);
      throw error;
    }
  }

  static async disconnect(): Promise<void> {
    if (!DatabaseManager.isConnected || !DatabaseManager.instance) {return;}

    try {
      await DatabaseManager.instance.$disconnect();
      DatabaseManager.isConnected = false;
      logger.info("[db] Disconnected from database");
    } catch (error) {
      logger.error("[db] Error during disconnect:", error as any);
    }
  }

  static async healthCheck(): Promise<boolean> {
    try {
      const prisma = DatabaseManager.getInstance();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error("[db] Health check failed:", error as any);
      // If using a SQLite file DB, the correct client may not have been available at import time.
      const dbUrl = process.env.DATABASE_URL || "";
      if (dbUrl.startsWith("file:")) {
        try {
          // Reinitialize with test client if it has been generated since startup
          DatabaseManager.instance = undefined as any;
          DatabaseManager.isConnected = false;
          DatabaseManager.prismaCtor = null;
          const prisma = DatabaseManager.getInstance();
          await prisma.$connect();
          await prisma.$queryRaw`SELECT 1`;
          return true;
        } catch (e2) {
          logger.error("[db] Retry with test client failed:", e2 as any);
        }
      }
      return false;
    }
  }

  static getConnectionStatus(): boolean {
    return DatabaseManager.isConnected;
  }
}

export { DatabaseManager };
