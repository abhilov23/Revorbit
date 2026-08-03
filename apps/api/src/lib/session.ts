import { createId } from "@paralleldrive/cuid2";
import { createRedis, type Redis } from "@revorbit/queue";

import { env, redisConfig } from "@/config/env";

export interface SessionStore {
  create(userId: string): Promise<string>;
  get(sessionId: string): Promise<string | null>;
  destroy(sessionId: string): Promise<void>;
}

export function createSessionStore(redis: Redis): SessionStore {
  const ttlSeconds = env.SESSION_TTL_SECONDS;

  async function create(userId: string): Promise<string> {
    const sessionId = createId();

    await redis.set(`session:${sessionId}`, userId, "EX", ttlSeconds);

    return sessionId;
  }

  async function get(sessionId: string): Promise<string | null> {
    return redis.get(`session:${sessionId}`);
  }

  async function destroy(sessionId: string): Promise<void> {
    await redis.del(`session:${sessionId}`);
  }

  return {
    create,
    get,
    destroy,
  };
}

const redis = createRedis(redisConfig);

export const sessionStore = createSessionStore(redis);
