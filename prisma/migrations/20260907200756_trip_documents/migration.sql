-- CreateTable
CREATE TABLE "TripDocument" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripDocument_tripId_createdAt_idx" ON "TripDocument"("tripId", "createdAt");

-- AddForeignKey
ALTER TABLE "TripDocument" ADD CONSTRAINT "TripDocument_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

