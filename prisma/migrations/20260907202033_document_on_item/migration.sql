-- AlterTable
ALTER TABLE "TripDocument" ADD COLUMN     "itemId" TEXT;

-- CreateIndex
CREATE INDEX "TripDocument_itemId_idx" ON "TripDocument"("itemId");

-- AddForeignKey
ALTER TABLE "TripDocument" ADD CONSTRAINT "TripDocument_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItineraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

