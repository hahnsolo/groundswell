-- "We delivered it" on the timeline (#74): which campaign, and how many signatures went with it.
ALTER TABLE "CauseAction" ADD COLUMN "campaignId" TEXT;
ALTER TABLE "CauseAction" ADD COLUMN "signatures" INTEGER;
