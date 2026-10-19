-- AlterTable
ALTER TABLE "Meetup" ADD COLUMN     "hostChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "anonymizedAt" TIMESTAMP(3),
ADD COLUMN     "deactivatedAt" TIMESTAMP(3);
