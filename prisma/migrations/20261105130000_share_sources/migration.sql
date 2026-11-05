-- Flyers and share images (#67): short links, and how people found a cause or event.
ALTER TABLE "Cause" ADD COLUMN "shortCode" TEXT;
ALTER TABLE "Meetup" ADD COLUMN "shortCode" TEXT;
ALTER TABLE "CauseMember" ADD COLUMN "source" TEXT;
ALTER TABLE "Rsvp" ADD COLUMN "source" TEXT;
CREATE UNIQUE INDEX "Cause_shortCode_key" ON "Cause"("shortCode");
CREATE UNIQUE INDEX "Meetup_shortCode_key" ON "Meetup"("shortCode");