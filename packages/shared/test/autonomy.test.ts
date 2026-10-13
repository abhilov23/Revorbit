import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCapability,
  AUTONOMY_LEVELS,
  CapabilityNotGrantedError,
  capabilitiesFor,
  hasCapability,
} from "../src/autonomy.js";

describe("autonomy capabilities", () => {
  it("grants nothing beyond ANALYZE at OBSERVE", () => {
    assert.deepEqual(capabilitiesFor("OBSERVE"), ["ANALYZE"]);
    assert.equal(hasCapability("OBSERVE", "COMMENT"), false);
    assert.equal(hasCapability("OBSERVE", "CREATE_BRANCH"), false);
    assert.equal(hasCapability("OBSERVE", "COMMIT_CHANGES"), false);
    assert.equal(hasCapability("OBSERVE", "CREATE_PR"), false);
    assert.equal(hasCapability("OBSERVE", "REQUEST_CHANGES"), false);
  });

  it("allows comments but never writes at SUGGEST", () => {
    assert.equal(hasCapability("SUGGEST", "ANALYZE"), true);
    assert.equal(hasCapability("SUGGEST", "COMMENT"), true);
    assert.equal(hasCapability("SUGGEST", "CREATE_BRANCH"), false);
    assert.equal(hasCapability("SUGGEST", "COMMIT_CHANGES"), false);
    assert.equal(hasCapability("SUGGEST", "CREATE_PR"), false);
  });

  it("allows proposing fixes at PROPOSE but not blocking reviews", () => {
    assert.equal(hasCapability("PROPOSE", "CREATE_BRANCH"), true);
    assert.equal(hasCapability("PROPOSE", "COMMIT_CHANGES"), true);
    assert.equal(hasCapability("PROPOSE", "CREATE_PR"), true);
    assert.equal(hasCapability("PROPOSE", "REQUEST_CHANGES"), false);
  });

  it("grants every capability at AUTONOMOUS", () => {
    for (const capability of [
      "ANALYZE",
      "COMMENT",
      "CREATE_BRANCH",
      "COMMIT_CHANGES",
      "CREATE_PR",
      "REQUEST_CHANGES",
    ] as const) {
      assert.equal(
        hasCapability("AUTONOMOUS", capability),
        true,
        `AUTONOMOUS should grant ${capability}`,
      );
    }
  });

  it("is monotonic: a higher level never grants less than a lower one", () => {
    const order = AUTONOMY_LEVELS;
    const capabilities = [
      "ANALYZE",
      "COMMENT",
      "CREATE_BRANCH",
      "COMMIT_CHANGES",
      "CREATE_PR",
      "REQUEST_CHANGES",
    ] as const;

    for (let i = 0; i < order.length - 1; i += 1) {
      const lower = order[i]!;
      const higher = order[i + 1]!;

      for (const capability of capabilities) {
        if (hasCapability(lower, capability)) {
          assert.equal(
            hasCapability(higher, capability),
            true,
            `${higher} should also grant ${capability} granted by ${lower}`,
          );
        }
      }
    }
  });

  it("grants strictly more at each step", () => {
    for (let i = 0; i < AUTONOMY_LEVELS.length - 1; i += 1) {
      const lower = capabilitiesFor(AUTONOMY_LEVELS[i]!).length;
      const higher = capabilitiesFor(AUTONOMY_LEVELS[i + 1]!).length;

      assert.ok(
        higher > lower,
        `${AUTONOMY_LEVELS[i + 1]} should grant more than ${AUTONOMY_LEVELS[i]}`,
      );
    }
  });

  it("throws with the offending capability named", () => {
    assert.throws(
      () => assertCapability("SUGGEST", "CREATE_PR"),
      (error: unknown) =>
        error instanceof CapabilityNotGrantedError &&
        error.capability === "CREATE_PR" &&
        error.level === "SUGGEST",
    );
  });

  it("does not throw when the capability is granted", () => {
    assert.doesNotThrow(() => assertCapability("PROPOSE", "CREATE_PR"));
  });
});
