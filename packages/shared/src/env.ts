import fs from "node:fs";
import path from "node:path";

export function findRepoRoot(startDir = process.cwd()): string | null {
  let dir = startDir;

  for (;;) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }

    dir = parent;
  }
}

export function getRepoRootEnvPath(): string {
  return path.join(findRepoRoot() ?? process.cwd(), ".env");
}

/**
 * Resolves a repo-relative path from a configured value.
 *
 * Each app runs with its own directory as `cwd`, so a value like
 * `apps/api/keys/app.pem` would resolve to `apps/api/apps/api/keys/app.pem`
 * under `pnpm --filter api dev`. Trying `cwd` first keeps app-local paths such
 * as `keys/app.pem` working, then falling back to the repo root.
 */
export function resolveRepoPath(configuredPath: string): string {
  const fromCwd = path.resolve(process.cwd(), configuredPath);

  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }

  const repoRoot = findRepoRoot();

  if (repoRoot) {
    const fromRoot = path.resolve(repoRoot, configuredPath);
    if (fs.existsSync(fromRoot)) {
      return fromRoot;
    }
  }

  // Nothing matched; return the cwd-relative path so the error message from
  // `readFileSync` names the location the caller actually asked for.
  return fromCwd;
}
