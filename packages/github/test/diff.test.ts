import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ChangedFile } from "@revorbit/shared";

import {
  buildDiffPositions,
  composeReviewBody,
  resolveInlineComments,
} from "../src/diff.js";

function file(filename: string, patch: string | undefined): ChangedFile {
  return {
    filename,
    status: "modified",
    additions: 0,
    deletions: 0,
    ...(patch === undefined ? {} : { patch }),
  };
}

/** Deletion with no new-side counterpart, so the line exists only on the left. */
const TRAILING_DELETION = [
  "@@ -10,3 +10,1 @@",
  " keep1;",
  "-removedA;",
  "-removedB;",
].join("\n");

/** A replacement puts the same line number on both sides. */
const REPLACEMENT = [
  "@@ -10,4 +10,4 @@",
  " keep;",
  "-const b = 2;",
  "+const b = 20;",
  " tail;",
].join("\n");

const NEW_FILE = ["@@ -0,0 +1,3 @@", "+one", "+two", "+three"].join("\n");

const DELETED_FILE = ["@@ -1,3 +0,0 @@", "-one", "-two", "-three"].join("\n");

const MULTI_HUNK = [
  "@@ -1,2 +1,2 @@",
  " a;",
  "+b;",
  "@@ -40,2 +41,2 @@",
  " c;",
  "+d;",
].join("\n");

const positions = buildDiffPositions([
  file("del.ts", TRAILING_DELETION),
  file("rep.ts", REPLACEMENT),
  file("new.ts", NEW_FILE),
  file("gone.ts", DELETED_FILE),
  file("multi.ts", MULTI_HUNK),
  file("img.png", undefined),
]);

function resolve(path: string, line: number) {
  return resolveInlineComments([{ path, line, body: "x" }], positions);
}

describe("diff position resolution", () => {
  it("resolves a pure deletion to LEFT", () => {
    const result = resolve("del.ts", 11);

    assert.equal(result.comments.length, 1);
    assert.equal(result.comments[0]?.side, "LEFT");
    assert.equal(result.unmapped.length, 0);
  });

  it("resolves a replaced line to RIGHT", () => {
    const result = resolve("rep.ts", 11);

    assert.equal(result.comments[0]?.side, "RIGHT");
  });

  it("resolves an added line in a new file to RIGHT", () => {
    const result = resolve("new.ts", 2);

    assert.equal(result.comments[0]?.side, "RIGHT");
  });

  it("resolves a line in a deleted file to LEFT", () => {
    const result = resolve("gone.ts", 2);

    assert.equal(result.comments[0]?.side, "LEFT");
  });

  it("prefers RIGHT for a context line present on both sides", () => {
    const result = resolve("del.ts", 10);

    assert.equal(result.comments[0]?.side, "RIGHT");
  });

  it("tracks line numbers across multiple hunks", () => {
    assert.equal(resolve("multi.ts", 2).comments[0]?.side, "RIGHT");
    // Second hunk starts at new line 41 after one insertion.
    assert.equal(resolve("multi.ts", 42).comments[0]?.side, "RIGHT");
  });

  it("rejects a line outside the diff rather than approximating", () => {
    const result = resolve("del.ts", 500);

    assert.equal(result.comments.length, 0);
    assert.equal(result.unmapped[0]?.reason, "line-not-in-diff");
  });

  it("rejects an unknown file", () => {
    const result = resolve("nope.ts", 1);

    assert.equal(result.unmapped[0]?.reason, "unknown-file");
  });

  it("rejects a file with no patch as unknown-file", () => {
    const result = resolve("img.png", 1);

    assert.equal(result.unmapped[0]?.reason, "unknown-file");
  });

  it("keeps mappable and unmappable findings separate", () => {
    const result = resolveInlineComments(
      [
        { path: "new.ts", line: 1, body: "good" },
        { path: "new.ts", line: 99, body: "bad" },
        { path: "gone.ts", line: 1, body: "also good" },
      ],
      positions,
    );

    assert.equal(result.comments.length, 2);
    assert.equal(result.unmapped.length, 1);
    assert.equal(result.unmapped[0]?.line, 99);
  });

  it("handles a diff with no hunk headers", () => {
    const empty = buildDiffPositions([
      file("x.ts", "diff --git a/x.ts b/x.ts\nindex 111..222\n"),
    ]);

    const result = resolveInlineComments(
      [{ path: "x.ts", line: 1, body: "x" }],
      empty,
    );

    assert.equal(result.unmapped.length, 1);
  });
});

describe("review body composition", () => {
  it("returns the summary untouched when everything mapped", () => {
    const { unmapped } = resolveInlineComments(
      [{ path: "new.ts", line: 1, body: "x" }],
      positions,
    );

    assert.equal(composeReviewBody("All good.", unmapped), "All good.");
  });

  it("preserves unmapped findings rather than dropping them", () => {
    const { unmapped } = resolveInlineComments(
      [
        { path: "new.ts", line: 1, body: "findings body" },
        { path: "new.ts", line: 99, body: "findings body" },
      ],
      positions,
    );

    const body = composeReviewBody("Summary.", unmapped);

    assert.match(body, /Summary\./);
    assert.match(body, /findings body/);
    assert.match(body, /new\.ts:99/);
  });

  it("explains the reason for each unmapped finding", () => {
    const { unmapped } = resolveInlineComments(
      [{ path: "img.png", line: 1, body: "x" }],
      positions,
    );

    assert.match(
      composeReviewBody("S.", unmapped),
      /binary|renamed|truncated/i,
    );
  });
});
