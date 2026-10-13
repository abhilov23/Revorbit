-- 4000 tokens truncated reasoning-model responses mid-JSON, so every review
-- failed to parse and was recorded as a partial review with no findings.
ALTER TABLE "RepositorySettings" ALTER COLUMN "maxTokens" SET DEFAULT 16000;
ALTER TABLE "RepositorySettings" ALTER COLUMN "model" SET DEFAULT 'gpt-4o-mini';

-- Repositories created before this change stored 4000 explicitly and would keep
-- failing, so existing rows are raised too.
UPDATE "RepositorySettings" SET "maxTokens" = 16000 WHERE "maxTokens" < 16000;