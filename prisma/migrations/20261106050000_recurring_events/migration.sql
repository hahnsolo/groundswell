-- Recurring events (#78): each occurrence is its own event, sharing a series id.
ALTER TABLE "Meetup" ADD COLUMN "seriesId" TEXT;
ALTER TABLE "Meetup" ADD COLUMN "repeat" TEXT;
CREATE INDEX "Meetup_seriesId_startsAt_idx" ON "Meetup"("seriesId", "startsAt");
