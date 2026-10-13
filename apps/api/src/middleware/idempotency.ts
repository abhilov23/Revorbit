import type { MiddlewareHandler } from "hono";
import { createRedis } from "@revorbit/queue";

import { env, redisConfig } from "@/config/env";

export const IDEMPOTENCY_HEADER = "idempotency-key";

/** Cached responses are replayable for an hour. */
const RETENTION_SECONDS = 60 * 60;

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/** Only the head of the body is fingerprinted; this bounds the stored size. */
const FINGERPRINT_INPUT = 4096;

interface CacheRecord {
  fingerprint: string;
  status: number;
  body: string;
  headers: Record<string, string>;
}

const redis = createRedis(redisConfig);

/**
 * Replay protection for dashboard mutations.
 *
 * With cookie auth, a mutation that lands but whose response is lost gets
 * retried, and the retry repeats the side effect. A cached response for the
 * same key is replayed instead.
 *
 * Webhooks are excluded: they dedupe on the GitHub delivery id, and reviews on
 * the pull request head SHA.
 *
 * The header is optional, so callers without one keep working unprotected.
 */
export const idempotency: MiddlewareHandler = async (c, next) => {
  if (c.req.method === "GET" || c.req.method === "HEAD") {
    return next();
  }

  if (c.req.path.endsWith("/github/webhook")) {
    return next();
  }

  const key = c.req.header(IDEMPOTENCY_HEADER);

  if (!key) {
    return next();
  }

  if (!KEY_PATTERN.test(key)) {
    return c.json(
      {
        success: false,
        error: {
          code: "INVALID_IDEMPOTENCY_KEY",
          message:
            "Idempotency-Key must be 8-128 characters of A-Z, a-z, 0-9, '-' or '_'.",
        },
      },
      400,
    );
  }

  // Authenticated callers are scoped by user. Unauthenticated mutations —
  // signup above all — are scoped by client address instead, otherwise the
  // endpoints most likely to be retried after a dropped response would be the
  // only ones with no replay protection.
  const scope = c.get("userId") ?? `ip:${clientAddress(c)}`;

  const cacheKey = `idem:${scope}:${c.req.method}:${c.req.path}:${key}`;

  // `clone()` leaves the original stream intact for the route handler.
  const bodyText = await c.req.raw
    .clone()
    .text()
    .catch(() => "");
  const fingerprint = bodyText.slice(0, FINGERPRINT_INPUT);

  const existing = await read(cacheKey);

  if (existing) {
    // Same key with a different body is a client bug, not a retry. Replaying
    // would return a response for an unrelated request.
    if (existing.fingerprint !== fingerprint) {
      return c.json(
        {
          success: false,
          error: {
            code: "IDEMPOTENCY_KEY_REUSED",
            message:
              "This Idempotency-Key was already used with a different request body.",
          },
        },
        409,
      );
    }

    c.header("Idempotency-Replayed", "true");

    return new Response(existing.body, {
      status: existing.status,
      headers: existing.headers,
    });
  }

  await next();

  // Only successful responses are worth replaying; a 4xx should be retried with
  // a corrected request under a new key.
  if (!c.res.ok) {
    return;
  }

  try {
    const body = await c.res.clone().text();
    const headers: Record<string, string> = {};

    c.res.headers.forEach((value, name) => {
      headers[name] = value;
    });

    const record: CacheRecord = {
      fingerprint,
      status: c.res.status,
      body,
      headers,
    };

    await redis.set(cacheKey, JSON.stringify(record), "EX", RETENTION_SECONDS);
  } catch {
    // Failing to cache must not fail the request that already succeeded.
  }
};

async function read(key: string): Promise<CacheRecord | null> {
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as CacheRecord) : null;
  } catch {
    // Redis being unreachable disables replay protection rather than the API.
    return null;
  }
}

/**
 * Best-effort client address for scoping unauthenticated keys.
 *
 * Uses the same trust rule as the rate limiter: forwarded headers are only
 * honoured behind a configured proxy.
 */
function clientAddress(c: {
  req: { header(name: string): string | undefined };
}): string {
  if (env.TRUST_PROXY) {
    const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();

    if (forwarded) {
      return forwarded;
    }
  }

  return c.req.header("x-real-ip")?.trim() ?? "anonymous";
}
