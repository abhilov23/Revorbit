-- ── Enums ──────────────────────────────────────────────────────────────
-- Role replaces Persona, and its members are renamed rather than deleted so
-- existing rows keep a valid value while they are rewritten below.
ALTER TYPE "Persona" RENAME TO "Role";

ALTER TYPE "Role" RENAME VALUE 'SECURITY' TO 'SECURITY_RESEARCHER';
ALTER TYPE "Role" RENAME VALUE 'ANALYZER' TO 'REVIEWER';
ALTER TYPE "Role" RENAME VALUE 'PERFORMANCE' TO 'DEVELOPER';
ALTER TYPE "Role" RENAME VALUE 'CUSTOM' TO 'HELPER';

CREATE TYPE "AutonomyLevel" AS ENUM ('OBSERVE', 'SUGGEST', 'PROPOSE', 'AUTONOMOUS');
CREATE TYPE "IssueStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');
CREATE TYPE "IssueType" AS ENUM ('bug', 'feature', 'security', 'documentation', 'performance', 'other');

-- ── Severity ────────────────────────────────────────────────────────────
-- Widened to the five-level scale. Existing rows are mapped onto it:
--   error -> high, warning -> medium, info -> low
ALTER TYPE "Severity" RENAME TO "SeverityLegacy";
CREATE TYPE "Severity" AS ENUM ('info', 'low', 'medium', 'high', 'critical');

CREATE TYPE "FindingCategory" AS ENUM ('bug', 'security', 'performance', 'quality', 'maintainability', 'architecture');

ALTER TABLE "ReviewComment"
  ADD COLUMN "category" "FindingCategory",
  ADD COLUMN "inline" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "githubCommentId" TEXT;

-- Backfill category from the severity the model used to report, so no row is
-- left without one before the NOT NULL constraint is applied.
UPDATE "ReviewComment"
SET "category" = CASE
  WHEN "severity" = 'error'   THEN 'security'::"FindingCategory"
  WHEN "severity" = 'warning' THEN 'maintainability'::"FindingCategory"
  ELSE 'quality'::"FindingCategory"
END
WHERE "category" IS NULL;

ALTER TABLE "ReviewComment" ALTER COLUMN "category" SET NOT NULL;

-- Convert the legacy severity values in place now that the new type exists.
ALTER TABLE "ReviewComment"
  ALTER COLUMN "severity" TYPE "Severity" USING (
    CASE "severity"
      WHEN 'error'   THEN 'high'::"Severity"
      WHEN 'warning' THEN 'medium'::"Severity"
      ELSE 'low'::"Severity"
    END
  );

DROP TYPE "SeverityLegacy";

-- ── RepositorySettings ──────────────────────────────────────────────────
ALTER TABLE "RepositorySettings" RENAME COLUMN "persona" TO "role";
ALTER TABLE "RepositorySettings"
  ADD COLUMN "autonomyLevel" "AutonomyLevel" NOT NULL DEFAULT 'SUGGEST';

-- ── UserSettings ────────────────────────────────────────────────────────
ALTER TABLE "UserSettings"
  ADD COLUMN "defaultAutonomy" "AutonomyLevel" NOT NULL DEFAULT 'SUGGEST';

-- ── Review: partial coverage ────────────────────────────────────────────
ALTER TABLE "Review"
  ADD COLUMN "partial" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "partialReason" TEXT,
  ADD COLUMN "chunksAnalyzed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "chunksFailed" INTEGER NOT NULL DEFAULT 0;

-- ── Issue ───────────────────────────────────────────────────────────────
CREATE TABLE "Issue" (
  "id" TEXT NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "state" TEXT NOT NULL DEFAULT 'OPEN',
  "status" "IssueStatus" NOT NULL DEFAULT 'PENDING',
  "issueType" "IssueType",
  "confidence" DOUBLE PRECISION,
  "summary" TEXT,
  "explanation" TEXT,
  "proposedApproach" TEXT,
  "suspectedFiles" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "fixBranch" TEXT,
  "fixPullNumber" INTEGER,
  "errorMessage" TEXT,
  "model" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Issue_repositoryId_number_key" ON "Issue"("repositoryId", "number");
CREATE INDEX "Issue_repositoryId_createdAt_idx" ON "Issue"("repositoryId", "createdAt");
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Webhook delivery idempotency ────────────────────────────────────────
CREATE TABLE "WebhookDelivery" (
  "id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "action" TEXT,
  "repository" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookDelivery_createdAt_idx" ON "WebhookDelivery"("createdAt");