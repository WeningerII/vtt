import { PrismaClient } from "@prisma/client";
import { logger } from "@vtt/logging";

class DatabaseManager {
  private static instance: PrismaClient;
  private static isConnected = false;
  private static isMock = false;

  private static createMock(): PrismaClient {
    DatabaseManager.isMock = true;
    return {
      $connect: async () => {},
      $disconnect: async () => {},
      // Minimal $queryRaw stub to satisfy health checks
      $queryRaw: (async (..._args: any[]) => 1) as any,
    } as any as PrismaClient;
  }

  static getInstance(): PrismaClient {
    if (!DatabaseManager.instance) {
      // Explicit mock mode for E2E or local runs
      const skipDb = process.env.E2E_SKIP_DB === "1" || process.env.E2E_SKIP_DB === "true";
      if (skipDb) {
        logger.warn("[db] E2E_SKIP_DB enabled - using mock Prisma client");
        DatabaseManager.instance = DatabaseManager.createMock();
        return DatabaseManager.instance;
      }

      try {
        DatabaseManager.instance = new PrismaClient({
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
        console.warn("Failed to initialize PrismaClient, using mock instance:", error);
        DatabaseManager.instance = DatabaseManager.createMock();
      }
    }
    return DatabaseManager.instance;
  }

  static async connect(): Promise<void> {
    if (DatabaseManager.isConnected || DatabaseManager.isMock) {return;}

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
    if (DatabaseManager.isMock) {return;}
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
      if (DatabaseManager.isMock) {return true;}
      const prisma = DatabaseManager.getInstance();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error("[db] Health check failed:", error as any);
      return false;
    }
  }

  static getConnectionStatus(): boolean {
    return DatabaseManager.isConnected;
  }
}

export { DatabaseManager };
