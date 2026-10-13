-- `ReviewComment.githubCommentId` was never written or read. The GitHub review
-- API returns comment ids only when fetching a review, and this worker creates
-- reviews without retaining that response, so the column was dead weight.
ALTER TABLE "ReviewComment" DROP COLUMN "githubCommentId";