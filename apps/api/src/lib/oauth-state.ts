import { createId } from "@paralleldrive/cuid2";
import { createRedis } from "@revorbit/queue";
import type { Redis } from "@revorbit/queue";

import { redisConfig } from "@/config/env";

const STATE_PREFIX = "oauth:state:";
/** OAuth round-trips should complete in minutes, not the session lifetime. */
const STATE_TTL_SECONDS = 10 * 60;

export interface OAuthStateStore {
  issue(): Promise<string>;
  /** Consumes the state, returning false if unknown, expired or already used. */
  consume(state: string): Promise<boolean>;
}

export function createOAuthStateStore(redis: Redis): OAuthStateStore {
  async function issue(): Promise<string> {
    const state = createId();

    await redis.set(
      `${STATE_PREFIX}${state}`,
      "1",
      "EX",
      STATE_TTL_SECONDS,
      "NX",
    );

    return state;
  }

  /**
   * Read-and-delete rather than a plain read: a state value is only ever valid
   * for the single callback that consumes it, so a replayed callback fails.
   */
  async function consume(state: string): Promise<boolean> {
    const result = await redis.del(`${STATE_PREFIX}${state}`);

    return result === 1;
  }

  return {
    issue,
    consume,
  };
}

const redis = createRedis(redisConfig);

export const oauthStateStore = createOAuthStateStore(redis);
