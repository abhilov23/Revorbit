-- AlterTable
ALTER TABLE "ReviewComment" ADD COLUMN     "fixedCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "problemCode" TEXT NOT NULL DEFAULT '';
