-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "homeCountry" TEXT,
    "homePostal" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "country" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "placeName" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "country" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "placeName" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "authorId" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Issue_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IssueSupport" (
    "issueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("issueId", "userId"),
    CONSTRAINT "IssueSupport_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IssueSupport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Meetup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "location" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "capacity" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Meetup_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Meetup_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Rsvp" (
    "meetupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("meetupId", "userId"),
    CONSTRAINT "Rsvp_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "Meetup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Rsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "ask" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "goal" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Campaign_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Campaign_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Signature" (
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("campaignId", "userId"),
    CONSTRAINT "Signature_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Signature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Issue_country_lat_lng_idx" ON "Issue"("country", "lat", "lng");

-- CreateIndex
CREATE INDEX "Issue_authorId_idx" ON "Issue"("authorId");

-- CreateIndex
CREATE INDEX "IssueSupport_userId_idx" ON "IssueSupport"("userId");

-- CreateIndex
CREATE INDEX "Comment_issueId_createdAt_idx" ON "Comment"("issueId", "createdAt");

-- CreateIndex
CREATE INDEX "Meetup_issueId_startsAt_idx" ON "Meetup"("issueId", "startsAt");

-- CreateIndex
CREATE INDEX "Rsvp_userId_idx" ON "Rsvp"("userId");

-- CreateIndex
CREATE INDEX "Campaign_issueId_idx" ON "Campaign"("issueId");

-- CreateIndex
CREATE INDEX "Signature_userId_idx" ON "Signature"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_targetType_targetId_reporterId_key" ON "Report"("targetType", "targetId", "reporterId");
