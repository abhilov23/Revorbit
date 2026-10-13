import type { RepositoryContextFile } from "@revorbit/shared";

/**
 * Import-graph context resolution.
 *
 * Turns source text plus a file tree into an ordered list of files worth
 * showing the model. Following the imports of the changed files beats listing
 * the repo alphabetically, which mostly surfaces unrelated files.
 *
 * No Octokit here on purpose, so it stays testable on its own.
 */

/** Extensions tried when a specifier has none, in resolution order. */
const RESOLVE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".svelte",
  ".json",
  ".py",
  ".go",
  ".rb",
  ".java",
  ".kt",
  ".rs",
  ".php",
  ".cs",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".swift",
  ".sql",
  ".sh",
  ".md",
] as const;

/** Tried when a specifier resolves to a directory. */
const INDEX_NAMES = [
  "index.ts",
  "index.tsx",
  "index.js",
  "index.jsx",
  "index.mjs",
  "index.py",
  "index.go",
  "mod.rs",
  "lib.rs",
  "__init__.py",
] as const;

const SKIP_EXACT = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "npm-shrinkwrap.json",
  "composer.lock",
  "gemfile.lock",
  "cargo.lock",
  "poetry.lock",
  "go.sum",
  ".ds_store",
]);

const SKIP_SEGMENTS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "vendor",
  "coverage",
  ".next",
  ".nuxt",
  ".git",
  "target",
  "__pycache__",
  ".venv",
  "venv",
  "migrations",
]);

const SKIP_PATTERN =
  /\.(min\.(js|css)|map|lock|png|jpe?g|gif|svg|ico|webp|avif|bmp|pdf|zip|gz|tgz|bz2|xz|jar|war|class|so|dylib|dll|exe|wasm|pyc|pyo|lock|woff2?|ttf|otf|eot|mp3|mp4|mov|avi|mkv|bin|dat)$/i;

/**
 * Import forms worth following. Bare package specifiers are filtered later, so
 * these patterns do not need to distinguish them.
 *
 * Each is rebuilt per call because a shared `/g` regex carries `lastIndex`
 * between calls and would silently skip matches.
 */
const IMPORT_PATTERNS = [
  // import ... from "x"  /  import "x"  /  import type ... from "x"
  /\bimport\s+(?:[^'"]*?\bfrom\s+)?["']([^"']+)["']/g,
  // export ... from "x"  /  export * from "x"
  /\bexport\s+[^'"]*?\bfrom\s+["']([^"']+)["']/g,
  // require("x")
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  // await import("x")
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

export interface ContextLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}

export const DEFAULT_CONTEXT_LIMITS: ContextLimits = {
  maxFiles: 12,
  maxFileBytes: 12_000,
  maxTotalBytes: 60_000,
};

export interface TreeEntry {
  sha: string;
  size: number;
}

export type TreeIndex = Map<string, TreeEntry>;

/**
 * Files that describe the stack rather than its logic. Useful for issue
 * triage, where there is no diff to seed imports from.
 */
export const MANIFEST_FILES = [
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "Gemfile",
  "composer.json",
  "README.md",
] as const;

/** Resolves `.` and `..` segments against a repository-relative path. */
export function normalizeRepoPath(input: string): string {
  const out: string[] = [];

  for (const segment of input.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }

    if (segment === "..") {
      out.pop();
      continue;
    }

    out.push(segment);
  }

  return out.join("/");
}

/**
 * True when a specifier can point at a file inside this repository.
 *
 * Bare specifiers (`react`, `@scope/pkg`) are packages and are never followed;
 * doing so would walk into `node_modules` and waste the context budget.
 */
export function isLocalSpecifier(specifier: string): boolean {
  if (specifier.startsWith("node_modules/")) {
    return false;
  }

  // Relative imports.
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return true;
  }

  // Bundler aliases that map to the repository root.
  if (
    specifier === "~" ||
    specifier.startsWith("~/") ||
    specifier.startsWith("@/")
  ) {
    return true;
  }

  return false;
}

/**
 * Extracts the distinct local import specifiers referenced by a source file. */
export function extractLocalImports(content: string): string[] {
  const found = new Set<string>();

  for (const pattern of IMPORT_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const specifier = match[1];

      if (specifier && isLocalSpecifier(specifier)) {
        found.add(specifier);
      }
    }
  }

  return [...found];
}

/** A slash-separated path with a file extension, e.g. `src/api/client.ts`. */
const PATH_LIKE_PATTERN =
  /(?:^|[\s`"'(])((?:[\w.@-]+\/)+[\w.@-]+\.[A-Za-z0-9]{1,12})/g;

/** A bare filename in backticks, e.g. `` `model.py` ``. */
const QUOTED_FILENAME_PATTERN = /`([\w.-]+\.[A-Za-z0-9]{1,12})`/g;

/**
 * Pulls candidate file paths out of free text such as an issue body.
 *
 * This is a heuristic, not a parser: every candidate is checked against the
 * real tree before anything is fetched, so a false positive costs nothing
 * while a missed path only costs context.
 */
export function extractMentionedPaths(text: string): string[] {
  const found = new Set<string>();

  for (const pattern of [PATH_LIKE_PATTERN, QUOTED_FILENAME_PATTERN]) {
    const regex = new RegExp(pattern.source, pattern.flags);

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const candidate = match[1];

      if (candidate) {
        found.add(normalizeRepoPath(candidate));
      }
    }
  }

  return [...found].filter(Boolean);
}

function extensionOf(path: string): string {
  const segment = path.slice(path.lastIndexOf("/") + 1);
  const dot = segment.lastIndexOf(".");

  return dot <= 0 ? "" : segment.slice(dot);
}

/**
 * Expands one specifier into the repository paths it could mean, in the order
 * they should be tried.
 *
 * Candidates are filtered against the real tree afterwards, so it is safe for
 * this to over-approximate.
 */
export function resolveImportSpecifier(
  specifier: string,
  importerPath: string,
): string[] {
  const importerDir = importerPath.includes("/")
    ? importerPath.slice(0, importerPath.lastIndexOf("/"))
    : "";

  const raw =
    specifier.startsWith("./") || specifier.startsWith("../")
      ? `${importerDir}/${specifier}`
      : specifier.slice(2);

  const normalized = normalizeRepoPath(raw);

  if (!normalized) {
    return [];
  }

  const candidates: string[] = [normalized];
  const extension = extensionOf(normalized);

  if (!extension) {
    for (const ext of RESOLVE_EXTENSIONS) {
      candidates.push(`${normalized}${ext}`);
    }

    // Only meaningful when the specifier names a directory. Probing them
    // unconditionally produces nonsense like "src/util/index.ts/index.ts",
    // which is harmless but pointless noise to filter on every candidate.
    for (const index of INDEX_NAMES) {
      candidates.push(`${normalized}/${index}`);
    }
  } else if (/^\.m?jsx?$/.test(extension) || extension === ".jsx") {
    // TypeScript sources routinely import "./x.js" while the file on disk is
    // "./x.ts" under NodeNext resolution.
    candidates.push(
      normalized.replace(/\.(mjs|cjs|js|jsx)$/, ".ts"),
      normalized.replace(/\.(mjs|cjs|js|jsx)$/, ".tsx"),
    );
  }

  return candidates;
}

/** True for files that are never worth spending context budget on. */
export function shouldSkipPath(path: string): boolean {
  const lower = path.toLowerCase();

  if (SKIP_EXACT.has(lower)) {
    return true;
  }

  const segments = lower.split("/");

  if (segments.some((segment) => SKIP_SEGMENTS.has(segment))) {
    return true;
  }

  return SKIP_PATTERN.test(lower);
}

/** Builds a path -> blob lookup from a recursive `git.getTree` response. */
export function buildTreeIndex(
  entries: Array<{ path?: string; sha?: string; size?: number; type?: string }>,
): TreeIndex {
  const index: TreeIndex = new Map();

  for (const entry of entries) {
    if (
      entry.type === "blob" &&
      entry.path &&
      entry.sha &&
      typeof entry.size === "number"
    ) {
      index.set(entry.path, { sha: entry.sha, size: entry.size });
    }
  }

  return index;
}

export interface SelectContextInput {
  index: TreeIndex;
  /** Candidate paths, highest relevance first. */
  candidates: string[];
  /** Paths already shown to the model, never repeated as context. */
  exclude?: Iterable<string>;
  limits?: ContextLimits;
}

export interface ContextSelection {
  /** Paths to fetch, in order. */
  paths: string[];
  /** Candidates rejected because they were oversized or not in the tree. */
  skipped: number;
}

/**
 * Chooses which candidate files fit the budget.
 *
 * Candidates are already ordered nearest-first by the caller; this preserves
 * that order and stops as soon as either the file count or the byte budget is
 * exhausted, so the most relevant files always win.
 */
export function selectContextFiles({
  index,
  candidates,
  exclude = [],
  limits = DEFAULT_CONTEXT_LIMITS,
}: SelectContextInput): ContextSelection {
  const excluded = exclude instanceof Set ? exclude : new Set(exclude);
  const seen = new Set<string>(excluded);
  const paths: string[] = [];

  let total = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    if (paths.length >= limits.maxFiles) {
      break;
    }

    if (seen.has(candidate) || shouldSkipPath(candidate)) {
      continue;
    }

    const entry = index.get(candidate);

    if (!entry) {
      skipped += 1;
      continue;
    }

    if (entry.size > limits.maxFileBytes) {
      skipped += 1;
      continue;
    }

    if (total + entry.size > limits.maxTotalBytes) {
      skipped += 1;
      continue;
    }

    seen.add(candidate);
    paths.push(candidate);
    total += entry.size;
  }

  return { paths, skipped };
}

/**
 * Expands a source file into the repository paths it imports.
 *
 * Returns the candidates for a single file rather than the whole graph, so the
 * caller controls breadth and API-call budget.
 */
export function expandImports(content: string, importerPath: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const specifier of extractLocalImports(content)) {
    for (const candidate of resolveImportSpecifier(specifier, importerPath)) {
      if (!seen.has(candidate)) {
        seen.add(candidate);
        out.push(candidate);
      }
    }
  }

  return out;
}

/**
 * Truncates a fetched file to the per-file budget, recording that it happened.
 *
 * Callers report truncation to the model instead of passing a silently clipped
 * file that the model may mistake for the complete source.
 */
export function clampContextFile(
  file: RepositoryContextFile,
  maxFileBytes: number,
): RepositoryContextFile {
  if (file.bytes <= maxFileBytes && file.content.length === file.bytes) {
    return file;
  }

  const clipped = file.content.slice(0, maxFileBytes);

  if (clipped === file.content) {
    return file;
  }

  return {
    ...file,
    content: clipped,
    truncated: true,
  };
}
