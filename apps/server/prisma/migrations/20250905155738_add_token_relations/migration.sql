-- CreateTable
CREATE TABLE "Monster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stableId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "statblock" JSONB NOT NULL,
    "tags" JSONB NOT NULL DEFAULT [],
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Token" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'VISIBLE',
    "gameSessionId" TEXT NOT NULL,
    "sceneId" TEXT,
    "characterId" TEXT,
    "actorId" TEXT,
    "assetId" TEXT,
    "x" REAL NOT NULL DEFAULT 0,
    "y" REAL NOT NULL DEFAULT 0,
    "z" REAL NOT NULL DEFAULT 0,
    "rotation" REAL NOT NULL DEFAULT 0,
    "scale" REAL NOT NULL DEFAULT 1,
    "width" INTEGER,
    "height" INTEGER,
    "disposition" TEXT,
    "conditions" TEXT,
    "health" INTEGER,
    "maxHealth" INTEGER,
    "initiative" INTEGER,
    "speed" INTEGER NOT NULL DEFAULT 30,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Token_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Token_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Token_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Token_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Token" ("characterId", "createdAt", "gameSessionId", "health", "id", "imageUrl", "initiative", "maxHealth", "metadata", "name", "rotation", "scale", "sceneId", "speed", "type", "updatedAt", "visibility", "x", "y", "z") SELECT "characterId", "createdAt", "gameSessionId", "health", "id", "imageUrl", "initiative", "maxHealth", "metadata", "name", "rotation", "scale", "sceneId", "speed", "type", "updatedAt", "visibility", "x", "y", "z" FROM "Token";
DROP TABLE "Token";
ALTER TABLE "new_Token" RENAME TO "Token";
CREATE INDEX "Token_gameSessionId_idx" ON "Token"("gameSessionId");
CREATE INDEX "Token_sceneId_idx" ON "Token"("sceneId");
CREATE INDEX "Token_type_idx" ON "Token"("type");
CREATE INDEX "Token_visibility_idx" ON "Token"("visibility");
CREATE INDEX "Token_gameSessionId_sceneId_idx" ON "Token"("gameSessionId", "sceneId");
CREATE INDEX "Token_x_y_idx" ON "Token"("x", "y");
CREATE INDEX "Token_actorId_idx" ON "Token"("actorId");
CREATE INDEX "Token_assetId_idx" ON "Token"("assetId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Monster_stableId_key" ON "Monster"("stableId");

-- CreateIndex
CREATE INDEX "Monster_name_idx" ON "Monster"("name");

-- CreateIndex
CREATE INDEX "Monster_stableId_idx" ON "Monster"("stableId");

-- CreateIndex
CREATE INDEX "Monster_createdAt_idx" ON "Monster"("createdAt");
