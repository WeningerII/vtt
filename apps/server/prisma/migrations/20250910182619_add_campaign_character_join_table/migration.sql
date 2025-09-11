-- CreateTable
CREATE TABLE "public"."CampaignCharacter" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'player',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignCharacter_campaignId_idx" ON "public"."CampaignCharacter"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignCharacter_characterId_idx" ON "public"."CampaignCharacter"("characterId");

-- CreateIndex
CREATE INDEX "CampaignCharacter_addedBy_idx" ON "public"."CampaignCharacter"("addedBy");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCharacter_campaignId_characterId_key" ON "public"."CampaignCharacter"("campaignId", "characterId");

-- AddForeignKey
ALTER TABLE "public"."CampaignCharacter" ADD CONSTRAINT "CampaignCharacter_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CampaignCharacter" ADD CONSTRAINT "CampaignCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
