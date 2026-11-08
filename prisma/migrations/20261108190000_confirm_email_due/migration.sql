-- A confirmation email couldn't be sent yet; the daily job sends a fresh link (#105).
ALTER TABLE "User" ADD COLUMN "confirmEmailDueAt" TIMESTAMP(3);
