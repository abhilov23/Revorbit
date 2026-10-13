import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import type { ChangedFile, RepositoryContextFile } from "@revorbit/shared";

import {
  DEFAULT_CONTEXT_LIMITS,
  MANIFEST_FILES,
  buildTreeIndex,
  clampContextFile,
  expandImports,
  selectContextFiles,
} from "./context.js";
import {
  buildDiffPositions,
  composeReviewBody,
  resolveInlineComments,
} from "./diff.js";

/**
 * Outcome of publishing a review.
 *
 * Reporting which findings became inline comments lets the caller persist the
 * distinction, so a finding that was folded into the review body is never
 * presented as if it were anchored to a line.
 */
export interface CreateReviewResult {
  postedCount: number;
  /** Findings that had no anchorable diff line. */
  unmapped: Array<{ path: string; line: number; index?: number }>;
}

export interface GithubAppConfig {
  appId: number;
  privateKey: string;
}

export interface GithubClient {
  app: Octokit;

  getInstallationClient(installationId: number): Promise<Octokit>;

  getInstallationRepositories(installationId: number): Promise<
    Array<{
      id: number;
      owner: string;
      name: string;
      fullName: string;
      defaultBranch: string;
    }>
  >;

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
  ): Promise<
    Array<{
      filename: string;
      status: string;
      additions: number;
      deletions: number;
      patch?: string;
    }>
  >;

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
      /**
       * Caller-supplied identifier echoed back in the result, so the caller can
       * record which of its own findings were published inline. Omitting it
       * still works; the result then only reports paths and lines.
       */
      index?: number;
    }>,
    /**
     * The exact file set the model was shown. Comment positions are validated
     * against this patch, not against the file on disk.
     */
    diff: ChangedFile[],
  ): Promise<CreateReviewResult>;

  getIssue(
    installationId: number,
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<{
    number: number;
    title: string;
    body: string | null;
    state: string;
  }>;

  listRepositoryFiles(
    installationId: number,
    owner: string,
    repo: string,
    ref: string,
    limit: number,
  ): Promise<ChangedFile[]>;

  /**
   * Fetches whole-file context for the paths a change depends on.
   *
   * `seedPaths` are the files the model is already reviewing; their imports
   * are followed one level to pull in the definitions the diff calls into.
   * When `includeManifests` is set, stack-describing files are added as a
   * floor, which is what issue triage uses when it has no diff to seed from.
   */
  getRepositoryContext(
    installationId: number,
    owner: string,
    repo: string,
    ref: string,
    seedPaths: string[],
    options?: {
      maxFiles?: number;
      maxFileBytes?: number;
      maxTotalBytes?: number;
      maxSeeds?: number;
      includeManifests?: boolean;
      /**
       * Whether seeds are omitted from the result. True for reviews, where the
       * seeds are the diff and are already shown. False for issues, where a
       * path named in the report is exactly the file that must come back.
       */
      excludeSeeds?: boolean;
    },
  ): Promise<RepositoryContextFile[]>;

  getRefSha(
    installationId: number,
    owner: string,
    repo: string,
    ref: string,
  ): Promise<string>;

  createBranch(
    installationId: number,
    owner: string,
    repo: string,
    branch: string,
    fromSha: string,
  ): Promise<void>;

  commitFiles(
    installationId: number,
    owner: string,
    repo: string,
    branch: string,
    message: string,
    files: Array<{ path: string; content: string }>,
  ): Promise<string>;

  createPullRequest(
    installationId: number,
    owner: string,
    repo: string,
    options: {
      title: string;
      head: string;
      base: string;
      body: string;
      draft: boolean;
    },
  ): Promise<number>;
}

const PER_PAGE = 100;
/** Installation tokens live for an hour; expire the cache slightly early. */
const TOKEN_TTL_MS = 50 * 60 * 1000;
const MAX_PAGES = 10;

export function createGithubApp(config: GithubAppConfig): GithubClient {
  const app = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.appId,
      privateKey: config.privateKey,
    },
  });

  /**
   * Installation access tokens are cached per installation.
   *
   * Minting a token per API call added a round-trip to every request and made
   * GitHub's installation-token rate limit reachable on a large pull request.
   */
  const tokenCache = new Map<number, { token: string; expiresAt: number }>();

  async function getInstallationToken(installationId: number): Promise<string> {
    const cached = tokenCache.get(installationId);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const {
      data: { token, expires_at },
    } = await app.rest.apps.createInstallationAccessToken({
      installation_id: installationId,
    });

    const expiresAt = expires_at
      ? new Date(expires_at).getTime()
      : Date.now() + TOKEN_TTL_MS;

    tokenCache.set(installationId, {
      token,
      expiresAt: Math.min(expiresAt, Date.now() + TOKEN_TTL_MS),
    });

    return token;
  }

  async function getInstallationClient(
    installationId: number,
  ): Promise<Octokit> {
    const token = await getInstallationToken(installationId);

    return new Octokit({ auth: token });
  }

  /**
   * Runs a call against an installation, retrying once with a fresh token on
   * `401 Invalid token`.
   *
   * GitHub revokes outstanding installation tokens whenever the app's
   * permissions or webhook configuration change. Without the retry, the cached
   * token stays dead for its whole TTL and every job fails until it expires.
   */
  async function withInstallation<T>(
    installationId: number,
    call: (octokit: Octokit) => Promise<T>,
  ): Promise<T> {
    try {
      return await call(await getInstallationClient(installationId));
    } catch (error) {
      const status = (error as { status?: number }).status;

      if (status !== 401) {
        throw error;
      }

      tokenCache.delete(installationId);

      return call(await getInstallationClient(installationId));
    }
  }

  /**
   * Follows `Link` pagination. GitHub caps a page at 100 items, so a single
   * unpaginated request silently truncated installations and pull requests
   * larger than that.
   */
  async function collectPages<T>(
    fetchPage: (page: number) => Promise<{ data: T[]; headers: unknown }>,
    extractNext: (headers: unknown) => number | undefined,
  ): Promise<T[]> {
    const all: T[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { data, headers } = await fetchPage(page);
      all.push(...data);

      const next = extractNext(headers);
      if (!next) {
        break;
      }
      page = next - 1;
    }

    return all;
  }

  function parseNextPage(headers: unknown): number | undefined {
    const link =
      (headers as { link?: string } | undefined)?.link ??
      (headers as { Link?: string } | undefined)?.Link;

    if (!link) {
      return undefined;
    }

    for (const part of link.split(",")) {
      const match = part.match(/[?&]page=(\d+)[^>]*>;\s*rel="next"/);
      if (match?.[1]) {
        return Number(match[1]);
      }
    }

    return undefined;
  }

  async function getInstallationRepositories(installationId: number) {
    const octokit = await getInstallationClient(installationId);

    const repositories = await collectPages(async (page) => {
      const { data, headers } =
        await octokit.rest.apps.listReposAccessibleToInstallation({
          per_page: PER_PAGE,
          page,
        });

      return { data: data.repositories, headers };
    }, parseNextPage);

    return repositories.map((repository) => ({
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
    const { data } = await withInstallation(installationId, (octokit) =>
      octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber }),
    );

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
    const files = await withInstallation(installationId, (octokit) =>
      collectPages(async (page) => {
        const { data, headers } = await octokit.rest.pulls.listFiles({
          owner,
          repo,
          pull_number: pullNumber,
          per_page: PER_PAGE,
          page,
        });

        return { data, headers };
      }, parseNextPage),
    );

    return files.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      // Binary and very large files have no patch; the prompt renders an
      // explicit placeholder for these.
      ...(file.patch === undefined ? {} : { patch: file.patch }),
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
      index?: number;
    }>,
    diff: ChangedFile[],
  ): Promise<CreateReviewResult> {
    // Findings are resolved against the exact patch the model was shown, so a
    // line number it produced can only become an inline comment when it really
    // addresses a changed line. Anything else moves to the review body rather
    // than risking a 422 that would fail the whole review.
    const { comments: inline, unmapped } = resolveInlineComments(
      comments.map((comment) => ({
        path: comment.path,
        line: comment.line,
        body: comment.body,
      })),
      buildDiffPositions(diff),
    );

    const body = composeReviewBody(summary, unmapped);

    await withInstallation(installationId, (octokit) =>
      octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: headSha,
        event: "COMMENT",
        body,
        // Omit the key entirely when nothing is mappable; an empty array is
        // rejected by some GitHub App permission configurations.
        ...(inline.length > 0 ? { comments: inline } : {}),
      }),
    );

    // Pair each unmapped finding back to the caller's own index, consuming
    // matches so two findings on the same file and line stay distinct.
    const consumed = new Set<number>();

    return {
      postedCount: inline.length,
      unmapped: unmapped.map((finding) => {
        let matchedIndex: number | undefined;

        for (let i = 0; i < comments.length; i += 1) {
          const comment = comments[i];

          if (
            comment &&
            !consumed.has(i) &&
            comment.path === finding.path &&
            comment.line === finding.line
          ) {
            matchedIndex = i;
            consumed.add(i);
            break;
          }
        }

        const callerIndex =
          matchedIndex === undefined
            ? undefined
            : comments[matchedIndex]?.index;

        return {
          path: finding.path,
          line: finding.line,
          ...(callerIndex === undefined ? {} : { index: callerIndex }),
        };
      }),
    };
  }

  async function getIssue(
    installationId: number,
    owner: string,
    repo: string,
    issueNumber: number,
  ) {
    const { data } = await withInstallation(installationId, (octokit) =>
      octokit.rest.issues.get({ owner, repo, issue_number: issueNumber }),
    );

    return {
      number: data.number,
      title: data.title,
      body: data.body ?? null,
      state: data.state,
    };
  }

  /**
   * Reads repository files as diff-shaped entries so the issue prompts can reuse
   * the same renderer and budget clamping as the review pipeline.
   */
  async function listRepositoryFiles(
    installationId: number,
    owner: string,
    repo: string,
    ref: string,
    limit: number,
  ) {
    return withInstallation(installationId, async (octokit) => {
      const tree = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: ref,
        recursive: "1",
      });

      const blobs = (tree.data.tree ?? []).filter(
        (entry) => entry.type === "blob" && entry.path && entry.sha,
      );

      const selected = blobs.slice(0, limit);
      const contents: ChangedFile[] = [];

      for (const entry of selected) {
        try {
          const { data } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: entry.sha as string,
          });

          const content =
            data.encoding === "base64"
              ? Buffer.from(data.content ?? "", "base64").toString("utf8")
              : (data.content ?? "");

          contents.push({
            filename: entry.path as string,
            status: "modified",
            additions: content.split("\n").length,
            deletions: 0,
            patch: content,
          });
        } catch {
          // A blob we cannot read (too large, or binary) is skipped rather than
          // failing the whole fetch.
        }
      }

      return contents;
    });
  }

  /**
   * Fetches whole-file context for the paths a change depends on.
   *
   * Follows the import graph of the seed files instead of listing the repo
   * alphabetically, so API calls scale with the change rather than the repo.
   * Tree sizes are checked up front, which keeps minified bundles and vendored
   * artifacts from eating the context budget.
   */
  async function getRepositoryContext(
    installationId: number,
    owner: string,
    repo: string,
    ref: string,
    seedPaths: string[],
    options: {
      maxFiles?: number;
      maxFileBytes?: number;
      maxTotalBytes?: number;
      maxSeeds?: number;
      includeManifests?: boolean;
      excludeSeeds?: boolean;
    } = {},
  ): Promise<RepositoryContextFile[]> {
    const limits = {
      maxFiles: options.maxFiles ?? DEFAULT_CONTEXT_LIMITS.maxFiles,
      maxFileBytes: options.maxFileBytes ?? DEFAULT_CONTEXT_LIMITS.maxFileBytes,
      maxTotalBytes:
        options.maxTotalBytes ?? DEFAULT_CONTEXT_LIMITS.maxTotalBytes,
    };

    const maxSeeds = options.maxSeeds ?? 15;
    const exclude = new Set(options.excludeSeeds === false ? [] : seedPaths);

    return withInstallation(installationId, async (octokit) => {
      const tree = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: ref,
        recursive: "1",
      });

      const index = buildTreeIndex(tree.data.tree ?? []);

      if (index.size === 0) {
        return [];
      }

      const readBlob = async (sha: string): Promise<string | undefined> => {
        try {
          const { data } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: sha,
          });

          return data.encoding === "base64"
            ? Buffer.from(data.content ?? "", "base64").toString("utf8")
            : (data.content ?? "");
        } catch {
          // A blob we cannot read is dropped rather than failing the review.
          return undefined;
        }
      };

      // Nearest-first: a file imported directly by a changed file outranks one
      // reached through a chain.
      const candidates: string[] = [];

      if (options.includeManifests) {
        for (const manifest of MANIFEST_FILES) {
          if (index.has(manifest)) {
            candidates.push(manifest);
          }
        }
      }

      let seedsRead = 0;

      for (const seed of seedPaths) {
        if (seedsRead >= maxSeeds) {
          break;
        }

        const entry = index.get(seed);

        // Deleted files have no blob and cannot contribute imports.
        if (!entry || entry.size > limits.maxFileBytes) {
          continue;
        }

        const content = await readBlob(entry.sha);

        if (content === undefined) {
          continue;
        }

        seedsRead += 1;
        candidates.push(...expandImports(content, seed));
      }

      const { paths } = selectContextFiles({
        index,
        candidates,
        exclude,
        limits,
      });

      const files = await Promise.all(
        paths.map(async (path) => {
          const entry = index.get(path)!;
          const content = await readBlob(entry.sha);

          if (content === undefined) {
            return undefined;
          }

          return clampContextFile(
            { path, content, truncated: false, bytes: entry.size },
            limits.maxFileBytes,
          );
        }),
      );

      return files.filter(
        (file): file is RepositoryContextFile => file !== undefined,
      );
    });
  }

  async function getRefSha(
    installationId: number,
    owner: string,
    repo: string,
    ref: string,
  ) {
    const { data } = await withInstallation(installationId, (octokit) =>
      octokit.rest.git.getRef({ owner, repo, ref: `heads/${ref}` }),
    );

    return data.object.sha;
  }

  async function createBranch(
    installationId: number,
    owner: string,
    repo: string,
    branch: string,
    fromSha: string,
  ) {
    await withInstallation(installationId, (octokit) =>
      octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: fromSha,
      }),
    );
  }

  /**
   * Writes files through the Git Data API.
   *
   * Using the content API per file would mean one request per file plus one
   * per commit; building the tree once keeps this to a fixed number of calls
   * regardless of how many files a fix touches.
   */
  async function commitFiles(
    installationId: number,
    owner: string,
    repo: string,
    branch: string,
    message: string,
    files: Array<{ path: string; content: string }>,
  ) {
    return withInstallation(installationId, async (octokit) => {
      const parentSha = await getRefSha(installationId, owner, repo, branch);

      const tree = await octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: parentSha,
        tree: files.map((file) => ({
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          content: file.content,
        })),
      });

      const commit = await octokit.rest.git.createCommit({
        owner,
        repo,
        message,
        tree: tree.data.sha,
        parents: [parentSha],
      });

      await octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: commit.data.sha,
      });

      return commit.data.sha;
    });
  }

  async function createPullRequest(
    installationId: number,
    owner: string,
    repo: string,
    options: {
      title: string;
      head: string;
      base: string;
      body: string;
      draft: boolean;
    },
  ) {
    const { data } = await withInstallation(installationId, (octokit) =>
      octokit.rest.pulls.create({
        owner,
        repo,
        title: options.title,
        head: options.head,
        base: options.base,
        body: options.body,
        draft: options.draft,
      }),
    );

    return data.number;
  }

  return {
    app,
    getInstallationClient,
    getInstallationRepositories,
    getPullRequest,
    getPullRequestFiles,
    createReview,
    getIssue,
    listRepositoryFiles,
    getRepositoryContext,
    getRefSha,
    createBranch,
    commitFiles,
    createPullRequest,
  };
}
