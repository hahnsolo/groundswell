-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "removalReason" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedById" TEXT;

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "removalReason" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedById" TEXT;

-- CreateIndex
CREATE INDEX "Comment_removedAt_idx" ON "Comment"("removedAt");

-- CreateIndex
CREATE INDEX "Issue_removedAt_idx" ON "Issue"("removedAt");
