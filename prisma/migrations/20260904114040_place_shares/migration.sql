-- CreateTable
CREATE TABLE "PlaceShare" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "categories" TEXT[],
    "statuses" TEXT[],
    "note" TEXT,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlaceShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaceShare_token_key" ON "PlaceShare"("token");

-- CreateIndex
CREATE INDEX "PlaceShare_userId_area_idx" ON "PlaceShare"("userId", "area");

-- AddForeignKey
ALTER TABLE "PlaceShare" ADD CONSTRAINT "PlaceShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

