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
