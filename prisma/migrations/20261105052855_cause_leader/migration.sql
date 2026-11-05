-- Causes get a leader, separate from who started them (#41). Every existing cause
-- is led by whoever started it.
ALTER TABLE "Cause" ADD COLUMN "leaderId" TEXT;
UPDATE "Cause" SET "leaderId" = "authorId";
ALTER TABLE "Cause" ALTER COLUMN "leaderId" SET NOT NULL;

-- CreateTable
CREATE TABLE "LeadOffer" (
    "id" TEXT NOT NULL,
    "causeId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "accepted" BOOLEAN,

    CONSTRAINT "LeadOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadOffer_causeId_idx" ON "LeadOffer"("causeId");

-- CreateIndex
CREATE INDEX "LeadOffer_toUserId_idx" ON "LeadOffer"("toUserId");

-- CreateIndex
CREATE INDEX "Cause_leaderId_idx" ON "Cause"("leaderId");

-- AddForeignKey
ALTER TABLE "Cause" ADD CONSTRAINT "Cause_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadOffer" ADD CONSTRAINT "LeadOffer_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "Cause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadOffer" ADD CONSTRAINT "LeadOffer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadOffer" ADD CONSTRAINT "LeadOffer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
