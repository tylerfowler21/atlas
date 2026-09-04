-- CreateTable
CREATE TABLE "NativeAuthCode" (
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NativeAuthCode_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "NativeAuthCode_expiresAt_idx" ON "NativeAuthCode"("expiresAt");

