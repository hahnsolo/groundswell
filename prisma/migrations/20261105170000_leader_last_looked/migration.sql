-- When someone leading a cause last opened it, for "new members since you last looked" on /me (#75).
ALTER TABLE "CauseMember" ADD COLUMN "lastLookedAt" TIMESTAMP(3);
