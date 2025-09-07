-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "activeSceneId" TEXT;

-- CreateIndex
CREATE INDEX "Campaign_activeSceneId_idx" ON "Campaign"("activeSceneId");
