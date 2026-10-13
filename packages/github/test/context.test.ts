import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTreeIndex,
  clampContextFile,
  expandImports,
  extractLocalImports,
  extractMentionedPaths,
  isLocalSpecifier,
  normalizeRepoPath,
  resolveImportSpecifier,
  selectContextFiles,
  shouldSkipPath,
  type TreeIndex,
} from "../src/context.js";

function indexOf(entries: Record<string, number>): TreeIndex {
  return buildTreeIndex(
    Object.entries(entries).map(([path, size]) => ({
      type: "blob",
      path,
      sha: `sha-${path}`,
      size,
    })),
  );
}

describe("normalizeRepoPath", () => {
  it("resolves . and .. against the repository root", () => {
    assert.equal(normalizeRepoPath("src/./a/../b.ts"), "src/b.ts");
    assert.equal(normalizeRepoPath("./src/api/client.js"), "src/api/client.js");
    assert.equal(normalizeRepoPath("../../outside.ts"), "outside.ts");
  });

  it("never escapes the root", () => {
    assert.equal(normalizeRepoPath("../../../etc/passwd"), "etc/passwd");
  });
});

describe("isLocalSpecifier", () => {
  it("accepts relative and alias specifiers", () => {
    for (const spec of ["./a", "../a", "@/lib/a", "~/lib/a", "~"]) {
      assert.equal(isLocalSpecifier(spec), true, spec);
    }
  });

  it("rejects packages so node_modules is never walked", () => {
    for (const spec of [
      "react",
      "react-dom/client",
      "@scope/package",
      "lodash/fp",
      "node_modules/x",
    ]) {
      assert.equal(isLocalSpecifier(spec), false, spec);
    }
  });
});

describe("extractLocalImports", () => {
  it("finds every import form and ignores packages", () => {
    const source = [
      'import React from "react";',
      'import { fetchJson } from "../api/client";',
      'import "./styles.css";',
      'export { helper } from "./helper";',
      'const lib = require("@/lib/util");',
      'const lazy = await import("../components/Model.jsx");',
      'import type { Config } from "./types.ts";',
    ].join("\n");

    assert.deepEqual(
      extractLocalImports(source).sort(),
      [
        "@/lib/util",
        "../api/client",
        "../components/Model.jsx",
        "./helper",
        "./styles.css",
        "./types.ts",
      ].sort(),
    );
  });

  it("does not carry regex state between calls", () => {
    const source = 'import a from "./a";\nimport b from "./b";';

    assert.equal(extractLocalImports(source).length, 2);
    assert.equal(extractLocalImports(source).length, 2);
  });

  it("ignores paths inside strings and comments that are not imports", () => {
    assert.deepEqual(extractLocalImports('const s = "./not-an-import";'), []);
  });
});

describe("resolveImportSpecifier", () => {
  it("resolves relative paths against the importer directory", () => {
    const candidates = resolveImportSpecifier(
      "../api/client",
      "src/components/Model.jsx",
    );

    assert.ok(candidates.includes("src/api/client"));
    assert.ok(candidates.includes("src/api/client.ts"));
    assert.ok(candidates.includes("src/api/client.js"));
  });

  it("treats alias specifiers as repository root", () => {
    const candidates = resolveImportSpecifier(
      "@/lib/util",
      "src/deep/nested/file.ts",
    );

    assert.ok(candidates.includes("lib/util"));
    assert.ok(candidates.includes("lib/util.ts"));
  });

  it("maps an explicit .js import onto the TypeScript source", () => {
    const candidates = resolveImportSpecifier("./x.js", "src/a.ts");

    assert.ok(candidates.includes("src/x.js"));
    assert.ok(candidates.includes("src/x.ts"));
  });

  it("probes directory index files", () => {
    assert.ok(
      resolveImportSpecifier("../util", "src/a/b.ts").includes(
        "src/util/index.ts",
      ),
    );
  });

  it("cannot be tricked into escaping the repository root", () => {
    for (const candidate of resolveImportSpecifier(
      "../../../../etc/passwd",
      "src/a.ts",
    )) {
      assert.ok(!candidate.startsWith(".."), candidate);
      assert.ok(!candidate.startsWith("/"), candidate);
    }
  });
});

describe("shouldSkipPath", () => {
  it("skips lockfiles, build output and vendored paths", () => {
    for (const path of [
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "src/app.min.js",
      "node_modules/react/index.js",
      "dist/bundle.js",
      "static/logo.png",
      "app.js.map",
      "db/migrations/0001_init.sql",
    ]) {
      assert.equal(shouldSkipPath(path), true, path);
    }
  });

  it("keeps ordinary source files", () => {
    for (const path of [
      "src/index.ts",
      "apps/api/src/modules/github/github.service.ts",
      "README.md",
    ]) {
      assert.equal(shouldSkipPath(path), false, path);
    }
  });
});

describe("selectContextFiles", () => {
  it("keeps only candidates that exist in the tree", () => {
    const { paths, skipped } = selectContextFiles({
      index: indexOf({ "src/a.ts": 100, "src/b.ts": 100 }),
      candidates: ["src/a.ts", "src/missing.ts", "src/b.ts"],
    });

    assert.deepEqual(paths, ["src/a.ts", "src/b.ts"]);
    assert.equal(skipped, 1);
  });

  it("never repeats an excluded seed", () => {
    const { paths } = selectContextFiles({
      index: indexOf({ "src/changed.ts": 100, "src/other.ts": 100 }),
      candidates: ["src/changed.ts", "src/other.ts"],
      exclude: ["src/changed.ts"],
    });

    assert.deepEqual(paths, ["src/other.ts"]);
  });

  it("preserves relevance order under the file cap", () => {
    const index = indexOf({
      "first.ts": 10,
      "second.ts": 10,
      "third.ts": 10,
    });

    const { paths } = selectContextFiles({
      index,
      candidates: ["first.ts", "second.ts", "third.ts"],
      limits: { maxFiles: 2, maxFileBytes: 1000, maxTotalBytes: 10_000 },
    });

    assert.deepEqual(paths, ["first.ts", "second.ts"]);
  });

  it("rejects a file that would blow the per-file budget", () => {
    const { paths, skipped } = selectContextFiles({
      index: indexOf({ "small.ts": 10, "huge.ts": 900_000 }),
      candidates: ["huge.ts", "small.ts"],
      limits: { maxFiles: 10, maxFileBytes: 12_000, maxTotalBytes: 100_000 },
    });

    assert.deepEqual(paths, ["small.ts"]);
    assert.equal(skipped, 1);
  });

  it("respects the total byte budget", () => {
    const { paths } = selectContextFiles({
      index: indexOf({ a: 600, b: 600, c: 600 }),
      candidates: ["a", "b", "c"],
      limits: { maxFiles: 10, maxFileBytes: 10_000, maxTotalBytes: 1000 },
    });

    assert.deepEqual(paths, ["a"]);
  });

  it("returns nothing for an empty candidate list", () => {
    assert.deepEqual(
      selectContextFiles({ index: indexOf({ "a.ts": 1 }), candidates: [] })
        .paths,
      [],
    );
  });
});

describe("expandImports", () => {
  it("produces deduplicated candidates across specifiers", () => {
    const source = [
      'import { a } from "./shared";',
      'import { b } from "./shared";',
      'export * from "../util/index.ts";',
    ].join("\n");

    const candidates = expandImports(source, "src/deep/file.ts");

    assert.equal(new Set(candidates).size, candidates.length);
    assert.ok(candidates.includes("src/deep/shared"));
    // `../util/index.ts` from `src/deep/` is `src/util/index.ts`, and because
    // the specifier already carries an extension no index files are probed.
    assert.ok(candidates.includes("src/util/index.ts"));
    assert.ok(!candidates.some((c) => c.startsWith("src/util/index.ts/")));
  });
});

describe("extractMentionedPaths", () => {
  it("finds paths and backticked filenames in issue text", () => {
    const text = [
      "The crash happens in `src/components/ModelView.jsx` when",
      "src/api/client.ts returns a 500. Also check `model.py`.",
      "See https://example.com/docs/page.html for context.",
    ].join(" ");

    const found = extractMentionedPaths(text);

    assert.ok(found.includes("src/components/ModelView.jsx"));
    assert.ok(found.includes("src/api/client.ts"));
    assert.ok(found.includes("model.py"));
  });

  it("produces only repository-relative paths", () => {
    for (const path of extractMentionedPaths("look at ../../etc/passwd")) {
      assert.ok(!path.startsWith(".."), path);
    }
  });
});

describe("buildTreeIndex", () => {
  it("keeps only blobs that carry a size", () => {
    const index = buildTreeIndex([
      { type: "blob", path: "a.ts", sha: "s", size: 10 },
      { type: "tree", path: "src", sha: "s" },
      { type: "blob", path: "b.ts", sha: "s" },
      { type: "blob", path: "c.ts" },
    ]);

    assert.deepEqual([...index.keys()], ["a.ts"]);
  });
});

describe("clampContextFile", () => {
  it("marks a truncated file rather than silently clipping it", () => {
    const clamped = clampContextFile(
      { path: "a.ts", content: "x".repeat(100), truncated: false, bytes: 100 },
      10,
    );

    assert.equal(clamped.content.length, 10);
    assert.equal(clamped.truncated, true);
    assert.equal(clamped.bytes, 100);
  });

  it("leaves a file within budget untouched", () => {
    const file = { path: "a.ts", content: "short", truncated: false, bytes: 5 };

    assert.equal(clampContextFile(file, 10), file);
  });
});
