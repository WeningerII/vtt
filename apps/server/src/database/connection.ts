import { PrismaClient } from "@prisma/client";
import { logger } from "@vtt/logging";

class DatabaseManager {
  private static instance: PrismaClient;
  private static isConnected = false;

  static getInstance(): PrismaClient {
    if (!DatabaseManager.instance) {
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
      return false;
    }
  }

  static getConnectionStatus(): boolean {
    return DatabaseManager.isConnected;
  }
}

export { DatabaseManager };
