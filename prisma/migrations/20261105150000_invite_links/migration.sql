-- Personal invite links for the people leading a cause, and who invited each member (#68).
ALTER TABLE "CauseMember" ADD COLUMN "inviteCode" TEXT;
ALTER TABLE "CauseMember" ADD COLUMN "invitedById" TEXT;

CREATE UNIQUE INDEX "CauseMember_inviteCode_key" ON "CauseMember"("inviteCode");
CREATE INDEX "CauseMember_causeId_invitedById_idx" ON "CauseMember"("causeId", "invitedById");
