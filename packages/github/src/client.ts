import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

export interface GithubAppConfig {
  appId: number;
  privateKey: string;
}

export interface GithubClient {
  app: Octokit;

  getInstallationClient(installationId: number): Promise<Octokit>;

  getInstallationRepositories(
    installationId: number,
  ): Promise<Array<{
    id: number;
    owner: string;
    name: string;
    fullName: string;
    defaultBranch: string;
  }>>;

  getPullRequest(
    installationId: number,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<{
    number: number;
    title: string;
    headSha: string;
  }>;

  getPullRequestFiles(
    installationId: number,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }>>;

  createReview(
    installationId: number,
    owner: string,
    repo: string,
    pullNumber: number,
    headSha: string,
    summary: string,
    comments: Array<{
      path: string;
      line: number;
      body: string;
    }>,
  ): Promise<void>;
}

export function createGithubApp(config: GithubAppConfig): GithubClient {
  const app = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.appId,
      privateKey: config.privateKey,
    },
  });

  async function getInstallationClient(
    installationId: number,
  ): Promise<Octokit> {
    const {
      data: { token },
    } = await app.rest.apps.createInstallationAccessToken({
      installation_id: installationId,
    });

    return new Octokit({
      auth: token,
    });
  }

  async function getInstallationRepositories(installationId: number) {
    const octokit = await getInstallationClient(installationId);

    const { data } = await octokit.rest.apps.listReposAccessibleToInstallation(
      {
        per_page: 100,
      },
    );

    return data.repositories.map((repository) => ({
      id: repository.id,
      owner: repository.owner.login,
      name: repository.name,
      fullName: repository.full_name,
      defaultBranch: repository.default_branch,
    }));
  }

  async function getPullRequest(
    installationId: number,
    owner: string,
    repo: string,
    pullNumber: number,
  ) {
    const octokit = await getInstallationClient(installationId);

    const { data } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });

    return {
      number: data.number,
      title: data.title,
      headSha: data.head.sha,
    };
  }

  async function getPullRequestFiles(
    installationId: number,
    owner: string,
    repo: string,
    pullNumber: number,
  ) {
    const octokit = await getInstallationClient(installationId);

    const { data } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });

    return data.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch ?? undefined,
    }));
  }

  async function createReview(
    installationId: number,
    owner: string,
    repo: string,
    pullNumber: number,
    headSha: string,
    summary: string,
    comments: Array<{
      path: string;
      line: number;
      body: string;
    }>,
  ) {
    const octokit = await getInstallationClient(installationId);

    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      commit_id: headSha,
      event: "COMMENT",
      body: summary,
      comments,
    });
  }

  return {
    app,
    getInstallationClient,
    getInstallationRepositories,
    getPullRequest,
    getPullRequestFiles,
    createReview,
  };
}
