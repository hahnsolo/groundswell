-- "Show my name on causes I join" (#79), on by default.
ALTER TABLE "User" ADD COLUMN "showName" BOOLEAN NOT NULL DEFAULT true;
