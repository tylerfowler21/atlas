-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "destinations" TEXT[] DEFAULT ARRAY[]::TEXT[];

