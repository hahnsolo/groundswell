-- Issues are called causes everywhere now (#48). Renames only: no data is
-- copied, dropped or changed, except report types saying "issue".
--
-- To undo, run the same statements with the names swapped, and
-- UPDATE "Report" SET "targetType" = 'issue' WHERE "targetType" = 'cause';

-- Issue -> Cause
ALTER TABLE "Issue" RENAME TO "Cause";
ALTER TABLE "Cause" RENAME CONSTRAINT "Issue_pkey" TO "Cause_pkey";
ALTER TABLE "Cause" RENAME CONSTRAINT "Issue_authorId_fkey" TO "Cause_authorId_fkey";
ALTER INDEX "Issue_authorId_idx" RENAME TO "Cause_authorId_idx";
ALTER INDEX "Issue_country_lat_lng_idx" RENAME TO "Cause_country_lat_lng_idx";
ALTER INDEX "Issue_removedAt_idx" RENAME TO "Cause_removedAt_idx";

-- IssueSupport -> CauseMember
ALTER TABLE "IssueSupport" RENAME TO "CauseMember";
ALTER TABLE "CauseMember" RENAME COLUMN "issueId" TO "causeId";
ALTER TABLE "CauseMember" RENAME CONSTRAINT "IssueSupport_pkey" TO "CauseMember_pkey";
ALTER TABLE "CauseMember" RENAME CONSTRAINT "IssueSupport_issueId_fkey" TO "CauseMember_causeId_fkey";
ALTER TABLE "CauseMember" RENAME CONSTRAINT "IssueSupport_userId_fkey" TO "CauseMember_userId_fkey";
ALTER INDEX "IssueSupport_userId_idx" RENAME TO "CauseMember_userId_idx";

-- issueId -> causeId on the things that belong to a cause
ALTER TABLE "Comment" RENAME COLUMN "issueId" TO "causeId";
ALTER TABLE "Comment" RENAME CONSTRAINT "Comment_issueId_fkey" TO "Comment_causeId_fkey";
ALTER INDEX "Comment_issueId_createdAt_idx" RENAME TO "Comment_causeId_createdAt_idx";

ALTER TABLE "Meetup" RENAME COLUMN "issueId" TO "causeId";
ALTER TABLE "Meetup" RENAME CONSTRAINT "Meetup_issueId_fkey" TO "Meetup_causeId_fkey";
ALTER INDEX "Meetup_issueId_startsAt_idx" RENAME TO "Meetup_causeId_startsAt_idx";

ALTER TABLE "Campaign" RENAME COLUMN "issueId" TO "causeId";
ALTER TABLE "Campaign" RENAME CONSTRAINT "Campaign_issueId_fkey" TO "Campaign_causeId_fkey";
ALTER INDEX "Campaign_issueId_idx" RENAME TO "Campaign_causeId_idx";

-- Reports name what they're about
UPDATE "Report" SET "targetType" = 'cause' WHERE "targetType" = 'issue';