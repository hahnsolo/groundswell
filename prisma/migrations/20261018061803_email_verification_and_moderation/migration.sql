-- AlterTable
ALTER TABLE "Report" ADD COLUMN "resolution" TEXT;
ALTER TABLE "Report" ADD COLUMN "resolvedAt" DATETIME;
ALTER TABLE "Report" ADD COLUMN "resolvedById" TEXT;

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" DATETIME,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "homeCountry" TEXT,
    "homePostal" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "homeCountry", "homePostal", "id", "name", "passwordHash") SELECT "createdAt", "email", "homeCountry", "homePostal", "id", "name", "passwordHash" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuthToken_userId_purpose_idx" ON "AuthToken"("userId", "purpose");
