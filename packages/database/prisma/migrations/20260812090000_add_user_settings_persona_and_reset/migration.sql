-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('error', 'warning', 'info');

-- CreateEnum
CREATE TYPE "Persona" AS ENUM ('SECURITY', 'ANALYZER', 'PERFORMANCE', 'CUSTOM');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetTokenHash" TEXT,
ADD COLUMN     "resetTokenExpires" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ReviewComment" ALTER COLUMN "severity" DROP DEFAULT,
ALTER COLUMN "severity" TYPE "Severity" USING ("severity"::"Severity");

-- AlterTable
ALTER TABLE "RepositorySettings" ADD COLUMN     "correctness" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "style" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "persona" "Persona" NOT NULL DEFAULT 'SECURITY',
ADD COLUMN     "customPrompt" TEXT,
ALTER COLUMN "model" SET DEFAULT 'gpt-4o-mini';

-- Carry the previous "bestPractices" toggle into the two focus areas that
-- replaced it, then drop the now-redundant column.
ALTER TABLE "RepositorySettings" DROP COLUMN "bestPractices";

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "defaultMaxFiles" INTEGER NOT NULL DEFAULT 20,
    "pullRequestReviews" BOOLEAN NOT NULL DEFAULT true,
    "inlineComments" BOOLEAN NOT NULL DEFAULT true,
    "mentionOnCritical" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT false,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetTokenHash_key" ON "User"("resetTokenHash");

-- Guarantee one review per pull-request commit so duplicate webhook deliveries
-- cannot enqueue the same job twice. Existing duplicates are collapsed first.
DELETE FROM "Review" WHERE "id" IN (
    SELECT "id" FROM (
        SELECT "id", ROW_NUMBER() OVER (
            PARTITION BY "repositoryId", "pullNumber", "headSha"
            ORDER BY "createdAt" DESC
        ) AS rn FROM "Review"
    ) ranked WHERE ranked.rn > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_repositoryId_pullNumber_headSha_key" ON "Review"("repositoryId", "pullNumber", "headSha");

-- CreateIndex
CREATE INDEX "Review_repositoryId_createdAt_idx" ON "Review"("repositoryId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;