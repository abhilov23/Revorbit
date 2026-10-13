import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FindingCategory, Severity } from "@revorbit/shared";

import {
  capComments,
  filterCommentsToSentFiles,
  MAX_COMMENTS,
  parseReviewResponse,
} from "../src/parser.js";
import { chunkFiles } from "../src/chunker.js";

type TestComment = {
  filePath: string;
  line: number;
  category: FindingCategory;
  severity: Severity;
  title: string;
  body: string;
  problemCode: string;
  fixedCode: string;
};

/**
 * Defaults are annotated with the real unions so an override stays assignable
 * to the parser's expected shape.
 */
function comment(overrides: Partial<TestComment> = {}): TestComment {
  return {
    filePath: "src/a.ts",
    line: 10,
    category: "bug",
    severity: "high",
    title: "Title",
    body: "Body",
    problemCode: "code",
    fixedCode: "fixed",
    ...overrides,
  };
}

const validResult = {
  summary: "Summary",
  comments: [comment()],
};

/**
 * Negative cases deliberately supply values outside the union. They bypass the
 * typed helper because the whole point is that the schema rejects them.
 */
function rawComment(overrides: Record<string, string | number>) {
  return JSON.stringify({
    ...comment(),
    ...overrides,
  });
}

describe("review response parsing", () => {
  it("parses a well-formed response", () => {
    assert.equal(
      parseReviewResponse(JSON.stringify(validResult)).comments.length,
      1,
    );
  });

  it("tolerates a fenced response", () => {
    const fenced = "```json\n" + JSON.stringify(validResult) + "\n```";

    assert.equal(parseReviewResponse(fenced).summary, "Summary");
  });

  it("recovers a response wrapped in prose", () => {
    const wrapped = `Sure!\n${JSON.stringify(validResult)}\nDone.`;

    assert.equal(parseReviewResponse(wrapped).summary, "Summary");
  });

  it("accepts a bare array of comments", () => {
    const parsed = parseReviewResponse(JSON.stringify([comment()]));

    assert.equal(parsed.comments.length, 1);
    assert.equal(parsed.summary, "");
  });

  it("rejects an out-of-range severity", () => {
    assert.throws(() =>
      parseReviewResponse(rawComment({ severity: "catastrophic" })),
    );
  });

  it("rejects an unknown category", () => {
    assert.throws(() => parseReviewResponse(rawComment({ category: "vibes" })));
  });

  it("rejects a non-positive line", () => {
    assert.throws(() => parseReviewResponse(rawComment({ line: 0 })));
  });

  it("rejects unparseable output", () => {
    assert.throws(() => parseReviewResponse("no json here"));
  });
});

describe("comment filtering", () => {
  it("drops comments for files that were never sent", () => {
    const filtered = filterCommentsToSentFiles(
      [
        comment({ filePath: "src/a.ts" }),
        comment({ filePath: "src/secret.ts" }),
      ],
      ["src/a.ts"],
    );

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.filePath, "src/a.ts");
  });

  it("drops everything when nothing was sent", () => {
    assert.equal(filterCommentsToSentFiles([comment()], []).length, 0);
  });

  it("caps the number of published comments", () => {
    const many = Array.from({ length: 30 }, (_, i) => comment({ line: i + 1 }));

    assert.equal(capComments(many).length, MAX_COMMENTS);
  });
});

describe("diff chunking", () => {
  function sized(patch: string) {
    return {
      filename: "a.ts",
      status: "modified",
      additions: 0,
      deletions: 0,
      patch,
    };
  }

  it("keeps small files together", () => {
    const chunks = chunkFiles([sized("a"), sized("b")], 1000);

    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]?.length, 2);
  });

  it("splits when the budget is exceeded", () => {
    const chunks = chunkFiles(
      [sized("a".repeat(60)), sized("b".repeat(60))],
      100,
    );

    assert.equal(chunks.length, 2);
  });

  it("gives an oversized file its own chunk rather than truncating it", () => {
    const big = "x".repeat(500);
    const chunks = chunkFiles([sized("a"), sized(big), sized("b")], 100);

    assert.equal(chunks.length, 3);
    assert.ok(chunks.some((chunk) => chunk[0]?.patch === big));
  });

  it("never loses a file", () => {
    const files = [
      sized("a".repeat(50)),
      sized("b".repeat(50)),
      sized("c".repeat(50)),
    ];
    const chunks = chunkFiles(files, 60);
    const total = chunks.flat().length;

    assert.equal(total, files.length);
  });
});
