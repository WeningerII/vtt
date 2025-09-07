/*
  Warnings:

  - You are about to drop the column `actorId` on the `Token` table. All the data in the column will be lost.
  - You are about to drop the column `assetId` on the `Token` table. All the data in the column will be lost.
  - You are about to drop the column `conditions` on the `Token` table. All the data in the column will be lost.
  - You are about to drop the column `disposition` on the `Token` table. All the data in the column will be lost.
  - You are about to drop the column `height` on the `Token` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `Token` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Condition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "duration" INTEGER,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppliedCondition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conditionId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "duration" INTEGER,
    "metadata" JSONB,
    "appliedBy" TEXT,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "AppliedCondition_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "Condition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "x" REAL NOT NULL DEFAULT 0,
    "y" REAL NOT NULL DEFAULT 0,
    "z" REAL NOT NULL DEFAULT 0,
    "rotation" REAL NOT NULL DEFAULT 0,
    "scale" REAL NOT NULL DEFAULT 1,
    "health" INTEGER,
    "maxHealth" INTEGER,
    "initiative" INTEGER,
    "speed" INTEGER NOT NULL DEFAULT 30,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Token_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Condition_name_idx" ON "Condition"("name");

-- CreateIndex
CREATE INDEX "Condition_type_idx" ON "Condition"("type");

-- CreateIndex
CREATE INDEX "Condition_createdAt_idx" ON "Condition"("createdAt");

-- CreateIndex
CREATE INDEX "AppliedCondition_targetId_targetType_idx" ON "AppliedCondition"("targetId", "targetType");

-- CreateIndex
CREATE INDEX "AppliedCondition_conditionId_idx" ON "AppliedCondition"("conditionId");

-- CreateIndex
CREATE INDEX "AppliedCondition_isActive_idx" ON "AppliedCondition"("isActive");

-- CreateIndex
CREATE INDEX "AppliedCondition_expiresAt_idx" ON "AppliedCondition"("expiresAt");

-- CreateIndex
CREATE INDEX "AppliedCondition_appliedAt_idx" ON "AppliedCondition"("appliedAt");
