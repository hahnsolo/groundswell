-- Cover images (#66): cover fields on causes and events, and a table of uploaded files.
-- AlterTable
ALTER TABLE "Cause" ADD COLUMN     "coverAlt" TEXT,
ADD COLUMN     "coverThumbUrl" TEXT,
ADD COLUMN     "coverUrl" TEXT;

-- AlterTable
ALTER TABLE "Meetup" ADD COLUMN     "coverAlt" TEXT,
ADD COLUMN     "coverThumbUrl" TEXT,
ADD COLUMN     "coverUrl" TEXT;

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "causeId" TEXT,
    "meetupId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_url_key" ON "MediaAsset"("url");

-- CreateIndex
CREATE INDEX "MediaAsset_causeId_idx" ON "MediaAsset"("causeId");

-- CreateIndex
CREATE INDEX "MediaAsset_meetupId_idx" ON "MediaAsset"("meetupId");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "Cause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "Meetup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
