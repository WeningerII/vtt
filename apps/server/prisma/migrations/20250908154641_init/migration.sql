-- CreateEnum
CREATE TYPE "public"."AssetKind" AS ENUM ('ORIGINAL', 'DEPTH', 'MASK', 'TILE', 'THUMBNAIL', 'METADATA');

-- CreateEnum
CREATE TYPE "public"."JobType" AS ENUM ('TEXT_TO_IMAGE', 'DEPTH', 'SEGMENTATION');

-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."TokenType" AS ENUM ('PC', 'NPC', 'MONSTER', 'OBJECT', 'EFFECT');

-- CreateEnum
CREATE TYPE "public"."TokenVisibility" AS ENUM ('VISIBLE', 'HIDDEN', 'PARTIAL', 'REVEALED');

-- CreateEnum
CREATE TYPE "public"."GameSessionStatus" AS ENUM ('WAITING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "public"."EncounterStatus" AS ENUM ('PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."ConditionType" AS ENUM ('BUFF', 'DEBUFF', 'NEUTRAL');

-- CreateTable
CREATE TABLE "public"."Map" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "widthPx" INTEGER NOT NULL,
    "heightPx" INTEGER NOT NULL,
    "gridSizePx" INTEGER NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'player',
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "subscription" TEXT NOT NULL DEFAULT 'free',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activeSceneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CampaignMember" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedAt" TIMESTAMP(3),
    "invitedBy" TEXT,

    CONSTRAINT "CampaignMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Scene" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "mapId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatMessage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Character" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sheet" JSONB NOT NULL,
    "prompt" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Monster" (
    "id" TEXT NOT NULL,
    "stableId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "statblock" JSONB NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Monster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Asset" (
    "id" TEXT NOT NULL,
    "mapId" TEXT,
    "kind" "public"."AssetKind" NOT NULL,
    "uri" TEXT NOT NULL,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GenerationJob" (
    "id" TEXT NOT NULL,
    "type" "public"."JobType" NOT NULL,
    "status" "public"."JobStatus" NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "mapId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProviderCall" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "costUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Token" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."TokenType" NOT NULL,
    "visibility" "public"."TokenVisibility" NOT NULL DEFAULT 'VISIBLE',
    "gameSessionId" TEXT NOT NULL,
    "sceneId" TEXT,
    "characterId" TEXT,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "z" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "health" INTEGER,
    "maxHealth" INTEGER,
    "initiative" INTEGER,
    "speed" INTEGER NOT NULL DEFAULT 30,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GameSession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" "public"."GameSessionStatus" NOT NULL DEFAULT 'WAITING',
    "currentSceneId" TEXT,
    "currentTurn" INTEGER NOT NULL DEFAULT 0,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Encounter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "sceneId" TEXT,
    "status" "public"."EncounterStatus" NOT NULL DEFAULT 'PLANNED',
    "initiativeOrder" JSONB,
    "currentTurn" INTEGER NOT NULL DEFAULT 0,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EncounterToken" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "initiative" INTEGER,
    "turnOrder" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "EncounterToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CampaignSettings" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "allowSpectators" BOOLEAN NOT NULL DEFAULT true,
    "maxPlayers" INTEGER NOT NULL DEFAULT 6,
    "autoAcceptInvites" BOOLEAN NOT NULL DEFAULT false,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "sessionTimeout" INTEGER NOT NULL DEFAULT 240,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Condition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."ConditionType" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "duration" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppliedCondition" (
    "id" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "duration" INTEGER,
    "metadata" JSONB,
    "appliedBy" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AppliedCondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Map_name_idx" ON "public"."Map"("name");

-- CreateIndex
CREATE INDEX "Map_createdAt_idx" ON "public"."Map"("createdAt");

-- CreateIndex
CREATE INDEX "Map_widthPx_heightPx_idx" ON "public"."Map"("widthPx", "heightPx");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "public"."User"("username");

-- CreateIndex
CREATE INDEX "User_displayName_idx" ON "public"."User"("displayName");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "public"."User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "public"."RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "public"."RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "public"."RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "public"."RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Campaign_name_idx" ON "public"."Campaign"("name");

-- CreateIndex
CREATE INDEX "Campaign_createdAt_idx" ON "public"."Campaign"("createdAt");

-- CreateIndex
CREATE INDEX "Campaign_activeSceneId_idx" ON "public"."Campaign"("activeSceneId");

-- CreateIndex
CREATE INDEX "CampaignMember_userId_idx" ON "public"."CampaignMember"("userId");

-- CreateIndex
CREATE INDEX "CampaignMember_campaignId_idx" ON "public"."CampaignMember"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignMember_role_campaignId_idx" ON "public"."CampaignMember"("role", "campaignId");

-- CreateIndex
CREATE INDEX "CampaignMember_status_campaignId_idx" ON "public"."CampaignMember"("status", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMember_userId_campaignId_key" ON "public"."CampaignMember"("userId", "campaignId");

-- CreateIndex
CREATE INDEX "Scene_campaignId_idx" ON "public"."Scene"("campaignId");

-- CreateIndex
CREATE INDEX "Scene_mapId_idx" ON "public"."Scene"("mapId");

-- CreateIndex
CREATE INDEX "Scene_campaignId_createdAt_idx" ON "public"."Scene"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_campaignId_timestamp_idx" ON "public"."ChatMessage"("campaignId", "timestamp");

-- CreateIndex
CREATE INDEX "ChatMessage_authorId_idx" ON "public"."ChatMessage"("authorId");

-- CreateIndex
CREATE INDEX "ChatMessage_channel_campaignId_idx" ON "public"."ChatMessage"("channel", "campaignId");

-- CreateIndex
CREATE INDEX "ChatMessage_timestamp_idx" ON "public"."ChatMessage"("timestamp");

-- CreateIndex
CREATE INDEX "Character_name_idx" ON "public"."Character"("name");

-- CreateIndex
CREATE INDEX "Character_provider_model_idx" ON "public"."Character"("provider", "model");

-- CreateIndex
CREATE INDEX "Character_createdAt_idx" ON "public"."Character"("createdAt");

-- CreateIndex
CREATE INDEX "Character_cost_idx" ON "public"."Character"("cost");

-- CreateIndex
CREATE UNIQUE INDEX "Monster_stableId_key" ON "public"."Monster"("stableId");

-- CreateIndex
CREATE INDEX "Monster_name_idx" ON "public"."Monster"("name");

-- CreateIndex
CREATE INDEX "Monster_stableId_idx" ON "public"."Monster"("stableId");

-- CreateIndex
CREATE INDEX "Monster_createdAt_idx" ON "public"."Monster"("createdAt");

-- CreateIndex
CREATE INDEX "Asset_mapId_idx" ON "public"."Asset"("mapId");

-- CreateIndex
CREATE INDEX "GenerationJob_mapId_idx" ON "public"."GenerationJob"("mapId");

-- CreateIndex
CREATE INDEX "GenerationJob_status_type_idx" ON "public"."GenerationJob"("status", "type");

-- CreateIndex
CREATE INDEX "GenerationJob_createdAt_idx" ON "public"."GenerationJob"("createdAt");

-- CreateIndex
CREATE INDEX "GenerationJob_updatedAt_idx" ON "public"."GenerationJob"("updatedAt");

-- CreateIndex
CREATE INDEX "GenerationJob_status_updatedAt_idx" ON "public"."GenerationJob"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ProviderCall_jobId_idx" ON "public"."ProviderCall"("jobId");

-- CreateIndex
CREATE INDEX "ProviderCall_provider_model_idx" ON "public"."ProviderCall"("provider", "model");

-- CreateIndex
CREATE INDEX "ProviderCall_success_provider_idx" ON "public"."ProviderCall"("success", "provider");

-- CreateIndex
CREATE INDEX "ProviderCall_createdAt_idx" ON "public"."ProviderCall"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderCall_costUSD_idx" ON "public"."ProviderCall"("costUSD");

-- CreateIndex
CREATE INDEX "Token_gameSessionId_idx" ON "public"."Token"("gameSessionId");

-- CreateIndex
CREATE INDEX "Token_sceneId_idx" ON "public"."Token"("sceneId");

-- CreateIndex
CREATE INDEX "Token_type_idx" ON "public"."Token"("type");

-- CreateIndex
CREATE INDEX "Token_visibility_idx" ON "public"."Token"("visibility");

-- CreateIndex
CREATE INDEX "Token_gameSessionId_sceneId_idx" ON "public"."Token"("gameSessionId", "sceneId");

-- CreateIndex
CREATE INDEX "Token_x_y_idx" ON "public"."Token"("x", "y");

-- CreateIndex
CREATE INDEX "GameSession_campaignId_idx" ON "public"."GameSession"("campaignId");

-- CreateIndex
CREATE INDEX "GameSession_status_idx" ON "public"."GameSession"("status");

-- CreateIndex
CREATE INDEX "GameSession_createdAt_idx" ON "public"."GameSession"("createdAt");

-- CreateIndex
CREATE INDEX "GameSession_startedAt_idx" ON "public"."GameSession"("startedAt");

-- CreateIndex
CREATE INDEX "GameSession_campaignId_status_idx" ON "public"."GameSession"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Encounter_gameSessionId_idx" ON "public"."Encounter"("gameSessionId");

-- CreateIndex
CREATE INDEX "Encounter_status_idx" ON "public"."Encounter"("status");

-- CreateIndex
CREATE INDEX "Encounter_sceneId_idx" ON "public"."Encounter"("sceneId");

-- CreateIndex
CREATE INDEX "Encounter_gameSessionId_status_idx" ON "public"."Encounter"("gameSessionId", "status");

-- CreateIndex
CREATE INDEX "Encounter_startedAt_idx" ON "public"."Encounter"("startedAt");

-- CreateIndex
CREATE INDEX "EncounterToken_encounterId_idx" ON "public"."EncounterToken"("encounterId");

-- CreateIndex
CREATE INDEX "EncounterToken_tokenId_idx" ON "public"."EncounterToken"("tokenId");

-- CreateIndex
CREATE INDEX "EncounterToken_initiative_idx" ON "public"."EncounterToken"("initiative");

-- CreateIndex
CREATE INDEX "EncounterToken_isActive_idx" ON "public"."EncounterToken"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterToken_encounterId_tokenId_key" ON "public"."EncounterToken"("encounterId", "tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignSettings_campaignId_key" ON "public"."CampaignSettings"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignSettings_campaignId_idx" ON "public"."CampaignSettings"("campaignId");

-- CreateIndex
CREATE INDEX "Condition_name_idx" ON "public"."Condition"("name");

-- CreateIndex
CREATE INDEX "Condition_type_idx" ON "public"."Condition"("type");

-- CreateIndex
CREATE INDEX "Condition_createdAt_idx" ON "public"."Condition"("createdAt");

-- CreateIndex
CREATE INDEX "AppliedCondition_targetId_targetType_idx" ON "public"."AppliedCondition"("targetId", "targetType");

-- CreateIndex
CREATE INDEX "AppliedCondition_conditionId_idx" ON "public"."AppliedCondition"("conditionId");

-- CreateIndex
CREATE INDEX "AppliedCondition_isActive_idx" ON "public"."AppliedCondition"("isActive");

-- CreateIndex
CREATE INDEX "AppliedCondition_expiresAt_idx" ON "public"."AppliedCondition"("expiresAt");

-- CreateIndex
CREATE INDEX "AppliedCondition_appliedAt_idx" ON "public"."AppliedCondition"("appliedAt");

-- AddForeignKey
ALTER TABLE "public"."RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CampaignMember" ADD CONSTRAINT "CampaignMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CampaignMember" ADD CONSTRAINT "CampaignMember_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Scene" ADD CONSTRAINT "Scene_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Scene" ADD CONSTRAINT "Scene_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "public"."Map"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "public"."Map"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GenerationJob" ADD CONSTRAINT "GenerationJob_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "public"."Map"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProviderCall" ADD CONSTRAINT "ProviderCall_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."GenerationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Token" ADD CONSTRAINT "Token_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "public"."GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Encounter" ADD CONSTRAINT "Encounter_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "public"."GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EncounterToken" ADD CONSTRAINT "EncounterToken_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "public"."Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EncounterToken" ADD CONSTRAINT "EncounterToken_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "public"."Token"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CampaignSettings" ADD CONSTRAINT "CampaignSettings_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppliedCondition" ADD CONSTRAINT "AppliedCondition_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "public"."Condition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
