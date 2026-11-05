-- CreateTable
CREATE TABLE "CoLeader" (
    "causeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "CoLeader_pkey" PRIMARY KEY ("causeId","userId")
);

-- CreateIndex
CREATE INDEX "CoLeader_userId_idx" ON "CoLeader"("userId");

-- AddForeignKey
ALTER TABLE "CoLeader" ADD CONSTRAINT "CoLeader_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "Cause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoLeader" ADD CONSTRAINT "CoLeader_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoLeader" ADD CONSTRAINT "CoLeader_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
