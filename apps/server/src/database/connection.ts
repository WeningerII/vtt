import path from "path";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { logger as importedLogger } from "@vtt/logging";

// Fallback logger in case @vtt/logging fails to load
const logger = importedLogger || {
  info: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.log.bind(console),
};

type PrismaClientConstructor = typeof PrismaClient;

type PrismaClientLike = PrismaClient & {
  $queryRaw: PrismaClient["$queryRaw"];
};

class DatabaseManager {
  private static instance: PrismaClientLike | null = null;
  private static isConnected = false;
  private static prismaCtor: PrismaClientConstructor | null = null;

  private static resolvePrismaCtor(): PrismaClientConstructor {
    if (DatabaseManager.prismaCtor) {
      return DatabaseManager.prismaCtor;
    }

    const dbUrl = process.env.DATABASE_URL || "";
    const isFileDb = dbUrl.startsWith("file:");

    if (isFileDb) {
      // Prefer the test client when using a SQLite file DB for E2E
      try {
        const testClientPath = path.resolve(
          process.cwd(),
          "node_modules/.prisma/test-client/index.js",
        );
        const requireForEsm = createRequire(__filename);
        const mod = requireForEsm(testClientPath) as { PrismaClient: PrismaClientConstructor };
        DatabaseManager.prismaCtor = mod.PrismaClient;
        logger.info("[db] Using Prisma test client for SQLite DB");
        return mod.PrismaClient;
      } catch (e) {
        const warning = e instanceof Error ? e.message : String(e);
        logger.warn("[db] Prisma test client not found; falling back to default client", {
          warning,
        });
      }
    }

    DatabaseManager.prismaCtor = PrismaClient;
    return PrismaClient;
  }

  static getInstance(): PrismaClientLike {
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
        }) as PrismaClientLike;
      } catch (error) {
        const initError = error instanceof Error ? error : new Error(String(error));
        console.warn("Prisma client initialization failed, using mock client:", initError);
        // Return a mock client that won't crash the server
        DatabaseManager.instance = {
          $connect: async () => undefined,
          $disconnect: async () => undefined,
          $queryRaw: PrismaClient.prototype.$queryRaw.bind(PrismaClient.prototype),
          user: { findFirst: () => null, create: () => null, findUnique: () => null },
          map: { findMany: () => [], create: () => null },
          // Add other mock methods as needed
        } as unknown as PrismaClientLike;
      }
    }
    return DatabaseManager.instance;
  }

  static async connect(): Promise<void> {
    if (DatabaseManager.isConnected) {
      return;
    }

    try {
      const prisma = DatabaseManager.getInstance();
      await prisma.$connect();
      DatabaseManager.isConnected = true;
      logger.info("[db] Connected to database");
    } catch (error) {
      const connectError = error instanceof Error ? error : new Error(String(error));
      logger.error("[db] Failed to connect:", connectError);
      throw connectError;
    }
  }

  static async disconnect(): Promise<void> {
    if (!DatabaseManager.isConnected || !DatabaseManager.instance) {
      return;
    }

    try {
      await DatabaseManager.instance.$disconnect();
      DatabaseManager.isConnected = false;
      logger.info("[db] Disconnected from database");
    } catch (error) {
      const disconnectError = error instanceof Error ? error : new Error(String(error));
      logger.error("[db] Error during disconnect:", disconnectError);
    }
  }

  static async healthCheck(): Promise<boolean> {
    try {
      const prisma = DatabaseManager.getInstance();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      const healthError = error instanceof Error ? error : new Error(String(error));
      logger.error("[db] Health check failed:", healthError);
      // If using a SQLite file DB, the correct client may not have been available at import time.
      const dbUrl = process.env.DATABASE_URL || "";
      if (dbUrl.startsWith("file:")) {
        try {
          // Reinitialize with test client if it has been generated since startup
          DatabaseManager.instance = null;
          DatabaseManager.isConnected = false;
          DatabaseManager.prismaCtor = null;
          const prisma = DatabaseManager.getInstance();
          await prisma.$connect();
          await prisma.$queryRaw`SELECT 1`;
          return true;
        } catch (e2) {
          const retryError = e2 instanceof Error ? e2 : new Error(String(e2));
          logger.error("[db] Retry with test client failed:", retryError);
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
