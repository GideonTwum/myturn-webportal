-- CreateTable
CREATE TABLE "ReconciliationSnapshot" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "discrepancyCount" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationSnapshot_createdAt_idx" ON "ReconciliationSnapshot"("createdAt");
