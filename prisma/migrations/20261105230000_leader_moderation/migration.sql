-- Leaders keeping their own cause's chat clean (#71).
ALTER TABLE "Comment" ADD COLUMN "hiddenByLeaderId" TEXT;

CREATE TABLE "CauseBan" (
    "causeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "byUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),

    CONSTRAINT "CauseBan_pkey" PRIMARY KEY ("causeId","userId")
);
CREATE INDEX "CauseBan_userId_idx" ON "CauseBan"("userId");

CREATE TABLE "LeaderAction" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "causeId" TEXT NOT NULL,
    "byUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "commentId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LeaderAction_createdAt_idx" ON "LeaderAction"("createdAt");
