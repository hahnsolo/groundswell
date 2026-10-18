-- CreateTable
CREATE TABLE "Throttle" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL,
    "resetAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Throttle_resetAt_idx" ON "Throttle"("resetAt");
