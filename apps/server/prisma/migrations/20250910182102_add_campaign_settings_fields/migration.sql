-- AlterTable
ALTER TABLE "public"."CampaignSettings" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gameSystem" TEXT NOT NULL DEFAULT 'dnd5e',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "CampaignSettings_isActive_idx" ON "public"."CampaignSettings"("isActive");
