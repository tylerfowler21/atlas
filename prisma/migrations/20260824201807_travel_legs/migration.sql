-- AlterTable
ALTER TABLE "ItineraryItem" ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'stop',
ADD COLUMN     "mode" TEXT,
ADD COLUMN     "toPlaceId" TEXT;

-- CreateIndex
CREATE INDEX "ItineraryItem_toPlaceId_idx" ON "ItineraryItem"("toPlaceId");

-- AddForeignKey
ALTER TABLE "ItineraryItem" ADD CONSTRAINT "ItineraryItem_toPlaceId_fkey" FOREIGN KEY ("toPlaceId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

