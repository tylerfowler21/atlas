-- CreateTable
CREATE TABLE "AuthError" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthError_createdAt_idx" ON "AuthError"("createdAt");

