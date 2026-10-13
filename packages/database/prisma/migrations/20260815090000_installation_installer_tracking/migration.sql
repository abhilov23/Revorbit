-- Records which GitHub account performed the installation, so an installation
-- can be linked to a Revorbit account that was created with email/password and
-- therefore has no githubId at the time the webhook arrives.
ALTER TABLE "Installation" ADD COLUMN "installedByGithubId" INTEGER;

CREATE INDEX "Installation_installedByGithubId_idx" ON "Installation"("installedByGithubId");