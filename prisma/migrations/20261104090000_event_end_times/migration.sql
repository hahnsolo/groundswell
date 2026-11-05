-- Events get a real end time (#19). Events from before this get one 2 hours
-- after their start, the length calendars were already assuming.
ALTER TABLE "Meetup" ADD COLUMN "endsAt" TIMESTAMP(3);
UPDATE "Meetup" SET "endsAt" = "startsAt" + INTERVAL '2 hours';
ALTER TABLE "Meetup" ALTER COLUMN "endsAt" SET NOT NULL;