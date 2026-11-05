-- Cause stages (#24): status becomes stage, worked out from each cause's history.
-- Renamed, not dropped, so nothing is lost.
ALTER TABLE "Cause" RENAME COLUMN "status" TO "stage";
ALTER TABLE "Cause" ALTER COLUMN "stage" SET DEFAULT 'raised';
UPDATE "Cause" SET "stage" = 'won' WHERE "stage" = 'resolved';
UPDATE "Cause" SET "stage" = 'taking_action' WHERE "stage" = 'in_progress';
UPDATE "Cause" SET "stage" = 'raised' WHERE "stage" NOT IN ('won', 'taking_action');
-- Then the furthest milestone each cause has already reached (stages only move forward).
UPDATE "Cause" c SET "stage" = 'gathering'
  WHERE "stage" = 'raised' AND (SELECT count(*) FROM "CauseMember" m WHERE m."causeId" = c."id") >= 5;
UPDATE "Cause" c SET "stage" = 'organizing'
  WHERE "stage" IN ('raised', 'gathering') AND EXISTS (SELECT 1 FROM "Meetup" e WHERE e."causeId" = c."id" AND e."startsAt" <= now());
UPDATE "Cause" c SET "stage" = 'taking_action'
  WHERE "stage" IN ('raised', 'gathering', 'organizing') AND EXISTS (SELECT 1 FROM "Campaign" k WHERE k."causeId" = c."id");

ALTER TABLE "Cause" ADD COLUMN "closedAt" TIMESTAMP(3),
ADD COLUMN "closedReason" TEXT,
ADD COLUMN "quietAskedAt" TIMESTAMP(3);
-- CreateTable
CREATE TABLE "WinProposal" (
    "id" TEXT NOT NULL,
    "causeId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "outcome" TEXT,

    CONSTRAINT "WinProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WinConfirmation" (
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WinConfirmation_pkey" PRIMARY KEY ("proposalId","userId")
);

-- CreateTable
CREATE TABLE "CauseAction" (
    "id" TEXT NOT NULL,
    "causeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "who" TEXT,
    "how" TEXT,
    "note" TEXT,
    "happenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CauseAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WinProposal_causeId_idx" ON "WinProposal"("causeId");

-- CreateIndex
CREATE INDEX "CauseAction_causeId_happenedAt_idx" ON "CauseAction"("causeId", "happenedAt");

-- AddForeignKey
ALTER TABLE "WinProposal" ADD CONSTRAINT "WinProposal_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "Cause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WinProposal" ADD CONSTRAINT "WinProposal_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WinConfirmation" ADD CONSTRAINT "WinConfirmation_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "WinProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WinConfirmation" ADD CONSTRAINT "WinConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CauseAction" ADD CONSTRAINT "CauseAction_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "Cause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CauseAction" ADD CONSTRAINT "CauseAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

