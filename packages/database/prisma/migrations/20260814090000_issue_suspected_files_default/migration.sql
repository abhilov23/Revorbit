-- A required scalar list with no default makes Prisma reject any insert that
-- omits the field, so creating an Issue without a preliminary analysis failed.
-- The column already defaults to an empty array at the database level; this
-- makes the default visible to Prisma's query engine.
ALTER TABLE "Issue" ALTER COLUMN "suspectedFiles" SET DEFAULT ARRAY[]::TEXT[];