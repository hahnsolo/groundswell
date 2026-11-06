-- Announcements can be hidden after reports and removed by moderators, and removal clears notifications (#97).
ALTER TABLE "Announcement" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Announcement" ADD COLUMN "removedAt" TIMESTAMP(3);
ALTER TABLE "Announcement" ADD COLUMN "removedById" TEXT;
ALTER TABLE "Announcement" ADD COLUMN "removalReason" TEXT;
CREATE INDEX "Announcement_removedAt_idx" ON "Announcement"("removedAt");

ALTER TABLE "Notification" ADD COLUMN "sourceId" TEXT;
CREATE INDEX "Notification_sourceId_idx" ON "Notification"("sourceId");
