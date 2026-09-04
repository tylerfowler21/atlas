-- AlterTable
ALTER TABLE "ItineraryItem" ADD COLUMN     "booking" TEXT,
ADD COLUMN     "bookingRef" TEXT;

-- CreateTable
CREATE TABLE "TripResource" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "note" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'app',
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TripResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripResource_tripId_position_idx" ON "TripResource"("tripId", "position");

-- AddForeignKey
ALTER TABLE "TripResource" ADD CONSTRAINT "TripResource_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

