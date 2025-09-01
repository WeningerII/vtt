-- CreateTable
CREATE TABLE "Map" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "widthPx" INTEGER NOT NULL,
    "heightPx" INTEGER NOT NULL,
    "gridSizePx" INTEGER NOT NULL DEFAULT 70,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CampaignMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    CONSTRAINT "CampaignMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignMember_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "mapId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Scene_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Scene_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sheet" JSONB NOT NULL,
    "prompt" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "cost" REAL NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT,
    "kind" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asset_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "mapId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GenerationJob_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProviderCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "costUSD" REAL NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderCall_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GenerationJob" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Token" (
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

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "currentSceneId" TEXT,
    "currentTurn" INTEGER NOT NULL DEFAULT 0,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "sceneId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "initiativeOrder" JSONB,
    "currentTurn" INTEGER NOT NULL DEFAULT 0,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Encounter_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EncounterToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounterId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "initiative" INTEGER,
    "turnOrder" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    CONSTRAINT "EncounterToken_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EncounterToken_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Map_name_idx" ON "Map"("name");

-- CreateIndex
CREATE INDEX "Map_createdAt_idx" ON "Map"("createdAt");

-- CreateIndex
CREATE INDEX "Map_widthPx_heightPx_idx" ON "Map"("widthPx", "heightPx");

-- CreateIndex
CREATE INDEX "User_displayName_idx" ON "User"("displayName");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Campaign_name_idx" ON "Campaign"("name");

-- CreateIndex
CREATE INDEX "Campaign_createdAt_idx" ON "Campaign"("createdAt");

-- CreateIndex
CREATE INDEX "CampaignMember_userId_idx" ON "CampaignMember"("userId");

-- CreateIndex
CREATE INDEX "CampaignMember_campaignId_idx" ON "CampaignMember"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignMember_role_campaignId_idx" ON "CampaignMember"("role", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMember_userId_campaignId_key" ON "CampaignMember"("userId", "campaignId");

-- CreateIndex
CREATE INDEX "Scene_campaignId_idx" ON "Scene"("campaignId");

-- CreateIndex
CREATE INDEX "Scene_mapId_idx" ON "Scene"("mapId");

-- CreateIndex
CREATE INDEX "Scene_campaignId_createdAt_idx" ON "Scene"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_campaignId_timestamp_idx" ON "ChatMessage"("campaignId", "timestamp");

-- CreateIndex
CREATE INDEX "ChatMessage_authorId_idx" ON "ChatMessage"("authorId");

-- CreateIndex
CREATE INDEX "ChatMessage_channel_campaignId_idx" ON "ChatMessage"("channel", "campaignId");

-- CreateIndex
CREATE INDEX "ChatMessage_timestamp_idx" ON "ChatMessage"("timestamp");

-- CreateIndex
CREATE INDEX "Character_name_idx" ON "Character"("name");

-- CreateIndex
CREATE INDEX "Character_provider_model_idx" ON "Character"("provider", "model");

-- CreateIndex
CREATE INDEX "Character_createdAt_idx" ON "Character"("createdAt");

-- CreateIndex
CREATE INDEX "Character_cost_idx" ON "Character"("cost");

-- CreateIndex
CREATE INDEX "Asset_mapId_idx" ON "Asset"("mapId");

-- CreateIndex
CREATE INDEX "GenerationJob_mapId_idx" ON "GenerationJob"("mapId");

-- CreateIndex
CREATE INDEX "GenerationJob_status_type_idx" ON "GenerationJob"("status", "type");

-- CreateIndex
CREATE INDEX "GenerationJob_createdAt_idx" ON "GenerationJob"("createdAt");

-- CreateIndex
CREATE INDEX "GenerationJob_updatedAt_idx" ON "GenerationJob"("updatedAt");

-- CreateIndex
CREATE INDEX "GenerationJob_status_updatedAt_idx" ON "GenerationJob"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ProviderCall_jobId_idx" ON "ProviderCall"("jobId");

-- CreateIndex
CREATE INDEX "ProviderCall_provider_model_idx" ON "ProviderCall"("provider", "model");

-- CreateIndex
CREATE INDEX "ProviderCall_success_provider_idx" ON "ProviderCall"("success", "provider");

-- CreateIndex
CREATE INDEX "ProviderCall_createdAt_idx" ON "ProviderCall"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderCall_costUSD_idx" ON "ProviderCall"("costUSD");

-- CreateIndex
CREATE INDEX "Token_gameSessionId_idx" ON "Token"("gameSessionId");

-- CreateIndex
CREATE INDEX "Token_sceneId_idx" ON "Token"("sceneId");

-- CreateIndex
CREATE INDEX "Token_type_idx" ON "Token"("type");

-- CreateIndex
CREATE INDEX "Token_visibility_idx" ON "Token"("visibility");

-- CreateIndex
CREATE INDEX "Token_gameSessionId_sceneId_idx" ON "Token"("gameSessionId", "sceneId");

-- CreateIndex
CREATE INDEX "Token_x_y_idx" ON "Token"("x", "y");

-- CreateIndex
CREATE INDEX "GameSession_campaignId_idx" ON "GameSession"("campaignId");

-- CreateIndex
CREATE INDEX "GameSession_status_idx" ON "GameSession"("status");

-- CreateIndex
CREATE INDEX "GameSession_createdAt_idx" ON "GameSession"("createdAt");

-- CreateIndex
CREATE INDEX "GameSession_startedAt_idx" ON "GameSession"("startedAt");

-- CreateIndex
CREATE INDEX "GameSession_campaignId_status_idx" ON "GameSession"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Encounter_gameSessionId_idx" ON "Encounter"("gameSessionId");

-- CreateIndex
CREATE INDEX "Encounter_status_idx" ON "Encounter"("status");

-- CreateIndex
CREATE INDEX "Encounter_sceneId_idx" ON "Encounter"("sceneId");

-- CreateIndex
CREATE INDEX "Encounter_gameSessionId_status_idx" ON "Encounter"("gameSessionId", "status");

-- CreateIndex
CREATE INDEX "Encounter_startedAt_idx" ON "Encounter"("startedAt");

-- CreateIndex
CREATE INDEX "EncounterToken_encounterId_idx" ON "EncounterToken"("encounterId");

-- CreateIndex
CREATE INDEX "EncounterToken_tokenId_idx" ON "EncounterToken"("tokenId");

-- CreateIndex
CREATE INDEX "EncounterToken_initiative_idx" ON "EncounterToken"("initiative");

-- CreateIndex
CREATE INDEX "EncounterToken_isActive_idx" ON "EncounterToken"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterToken_encounterId_tokenId_key" ON "EncounterToken"("encounterId", "tokenId");
