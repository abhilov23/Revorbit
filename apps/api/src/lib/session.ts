import { createHmac, timingSafeEqual } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { createRedis, type Redis } from "@revorbit/queue";

import { env, redisConfig } from "@/config/env";

export interface SessionStore {
  create(userId: string): Promise<string>;
  get(sessionId: string): Promise<string | null>;
  destroy(sessionId: string): Promise<void>;
  /** Invalidates every session belonging to a user. */
  destroyAllForUser(userId: string): Promise<number>;
  /** How many live sessions a user has. */
  countForUser(userId: string): Promise<number>;
}

function sign(value: string): string {
  return createHmac("sha256", env.SESSION_SECRET)
    .update(value)
    .digest("base64url");
}

/**
 * Cookie value is `<id>.<hmac>`.
 *
 * The Redis session id is already unguessable, but binding it to
 * SESSION_SECRET means a value read out of Redis (or a stale database dump)
 * cannot be replayed as a cookie without the signing key.
 */
function pack(id: string): string {
  return `${id}.${sign(id)}`;
}

function unpack(cookie: string): string | null {
  const separator = cookie.lastIndexOf(".");

  if (separator <= 0) {
    return null;
  }

  const id = cookie.slice(0, separator);
  const provided = cookie.slice(separator + 1);
  const expected = sign(id);

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);

  if (providedBuf.length !== expectedBuf.length) {
    return null;
  }

  return timingSafeEqual(providedBuf, expectedBuf) ? id : null;
}

export function createSessionStore(redis: Redis): SessionStore {
  const ttlSeconds = env.SESSION_TTL_SECONDS;

  /**
   * Secondary index of `session:<userId>` -> set of session ids.
   *
   * Without it a password reset cannot revoke the sessions it should: the
   * primary key is per-session, so there is no way to find a user's other
   * sessions. The index carries the same TTL as the sessions themselves so it
   * cannot outlive them.
   */
  async function track(userId: string, sessionId: string): Promise<void> {
    const key = `sessions:${userId}`;

    await redis.multi().sadd(key, sessionId).expire(key, ttlSeconds).exec();
  }

  async function create(userId: string): Promise<string> {
    const sessionId = createId();

    await redis.set(`session:${sessionId}`, userId, "EX", ttlSeconds);
    await track(userId, sessionId);

    return pack(sessionId);
  }

  async function get(cookie: string): Promise<string | null> {
    const sessionId = unpack(cookie);

    if (!sessionId) {
      return null;
    }

    return redis.get(`session:${sessionId}`);
  }

  async function destroy(cookie: string): Promise<void> {
    const sessionId = unpack(cookie);

    if (!sessionId) {
      return;
    }

    const userId = await redis.get(`session:${sessionId}`);

    await redis.del(`session:${sessionId}`);

    if (userId) {
      await redis.srem(`sessions:${userId}`, sessionId);
    }
  }

  async function destroyAllForUser(userId: string): Promise<number> {
    const key = `sessions:${userId}`;
    const ids = await redis.smembers(key);

    if (ids.length === 0) {
      return 0;
    }

    const pipeline = redis.multi();
    for (const id of ids) {
      pipeline.del(`session:${id}`);
    }
    pipeline.del(key);
    await pipeline.exec();

    return ids.length;
  }

  async function countForUser(userId: string): Promise<number> {
    return redis.scard(`sessions:${userId}`);
  }

  return {
    create,
    get,
    destroy,
    destroyAllForUser,
    countForUser,
  };
}

const redis = createRedis(redisConfig);

export const sessionStore = createSessionStore(redis);
