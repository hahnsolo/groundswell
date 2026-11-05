-- CreateTable
CREATE TABLE "AreaRepresentatives" (
    "country" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "reps" JSONB NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AreaRepresentatives_pkey" PRIMARY KEY ("country","postalCode")
);
