import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseIssueFix, validateFixFiles } from "../src/issues.js";

function paths(list: string[]) {
  const { accepted, rejected } = validateFixFiles(
    list.map((path) => ({ path, content: "x" })),
  );

  return {
    accepted: accepted.map((file) => file.path),
    rejected: rejected.map((entry) => entry.path),
  };
}

describe("generated fix path validation", () => {
  it("rejects CI workflow files", () => {
    assert.deepEqual(paths([".github/workflows/deploy.yml"]).accepted, []);
  });

  it("rejects path traversal", () => {
    assert.deepEqual(paths(["../escape.ts"]).accepted, []);
    assert.deepEqual(paths(["src/../../escape.ts"]).accepted, []);
  });

  it("rejects traversal written with backslashes", () => {
    const result = paths(["..\\..\\secrets.ts"]);

    assert.deepEqual(result.accepted, []);
    assert.equal(
      validateFixFiles([{ path: "..\\..\\x.ts", content: "x" }]).rejected[0]
        ?.reason,
      "path traversal",
    );
  });

  it("rejects absolute paths", () => {
    assert.deepEqual(paths(["/etc/passwd"]).accepted, []);
    assert.deepEqual(paths(["C:/Windows/system.ini"]).accepted, []);
  });

  it("rejects git internals", () => {
    assert.deepEqual(paths([".git/config"]).accepted, []);
    assert.deepEqual(paths([".git/hooks/pre-commit"]).accepted, []);
  });

  it("rejects secrets and credential material", () => {
    for (const path of [
      ".env",
      ".env.production",
      "keys/private.pem",
      "config/secrets.yaml",
      ".npmrc",
      ".ssh/authorized_keys",
      ".aws/credentials",
    ]) {
      assert.deepEqual(
        paths([path]).accepted,
        [],
        `${path} should be rejected`,
      );
    }
  });

  it("rejects lockfiles", () => {
    assert.deepEqual(paths(["package-lock.json"]).accepted, []);
    assert.deepEqual(paths(["pnpm-lock.yaml"]).accepted, []);
  });

  it("rejects a leading ./ prefix", () => {
    assert.deepEqual(paths(["./src/app.ts"]).accepted, []);
  });

  it("allows ordinary source paths", () => {
    const result = paths([
      "src/lib/thing.ts",
      "packages/api/src/other.ts",
      "apps/web/app/page.tsx",
    ]);

    assert.equal(result.accepted.length, 3);
  });

  it("caps the number of files without failing the batch", () => {
    const { accepted, rejected } = validateFixFiles(
      Array.from({ length: 14 }, (_, i) => ({
        path: `src/file${i}.ts`,
        content: "x",
      })),
    );

    assert.equal(accepted.length, 10);
    assert.equal(rejected.length, 4);
    assert.equal(rejected[0]?.reason, "exceeds file count limit");
  });

  it("collapses duplicate paths", () => {
    const { accepted, rejected } = validateFixFiles([
      { path: "a.ts", content: "1" },
      { path: "a.ts", content: "2" },
    ]);

    assert.equal(accepted.length, 1);
    assert.equal(rejected[0]?.reason, "duplicate path");
  });

  it("rejects an oversized file", () => {
    const { accepted } = validateFixFiles([
      { path: "a.ts", content: "x".repeat(200_001) },
    ]);

    assert.equal(accepted.length, 0);
  });
});

describe("issue fix parsing", () => {
  const valid = {
    summary: "Fix the thing",
    explanation: "Because",
    files: [{ path: "src/a.ts", content: "export {};" }],
    commitMessage: "Fix thing",
  };

  it("parses a well-formed response", () => {
    assert.equal(parseIssueFix(JSON.stringify(valid)).summary, "Fix the thing");
  });

  it("tolerates a fenced response", () => {
    const fenced = "```json\n" + JSON.stringify(valid) + "\n```";

    assert.equal(parseIssueFix(fenced).commitMessage, "Fix thing");
  });

  it("recovers a response wrapped in prose", () => {
    const wrapped = `Here is the fix:\n${JSON.stringify(valid)}\nLet me know.`;

    assert.equal(parseIssueFix(wrapped).summary, "Fix the thing");
  });

  it("rejects a response with no files", () => {
    assert.throws(() => parseIssueFix(JSON.stringify({ ...valid, files: [] })));
  });

  it("rejects malformed JSON", () => {
    assert.throws(() => parseIssueFix("not json at all"));
  });
});
