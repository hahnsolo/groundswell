-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "fixer" TEXT NOT NULL DEFAULT 'unsure',
ADD COLUMN     "fixerOther" TEXT;
