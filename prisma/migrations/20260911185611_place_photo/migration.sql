-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "photoAttribution" TEXT,
ADD COLUMN     "photoCheckedAt" TIMESTAMP(3),
ADD COLUMN     "photoSourceUrl" TEXT,
ADD COLUMN     "photoUrl" TEXT;
