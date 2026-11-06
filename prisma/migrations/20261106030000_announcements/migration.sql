-- Announcements to all members (#73).
ALTER TABLE "User" ADD COLUMN "notifyAnnouncements" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "causeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unpinnedAt" TIMESTAMP(3),

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Announcement_causeId_createdAt_idx" ON "Announcement"("causeId", "createdAt");

CREATE TABLE "AnnouncementNotice" (
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "via" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "AnnouncementNotice_pkey" PRIMARY KEY ("announcementId","userId")
);
CREATE INDEX "AnnouncementNotice_sentAt_idx" ON "AnnouncementNotice"("sentAt");
CREATE INDEX "AnnouncementNotice_userId_idx" ON "AnnouncementNotice"("userId");

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "Cause"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnouncementNotice" ADD CONSTRAINT "AnnouncementNotice_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnouncementNotice" ADD CONSTRAINT "AnnouncementNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
