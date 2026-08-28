-- CreateTable
CREATE TABLE "CategoryOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryOverride_userId_idx" ON "CategoryOverride"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryOverride_userId_categoryId_key" ON "CategoryOverride"("userId", "categoryId");

-- AddForeignKey
ALTER TABLE "CategoryOverride" ADD CONSTRAINT "CategoryOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

