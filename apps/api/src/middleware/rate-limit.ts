import type { MiddlewareHandler } from "hono";
import { createRedis } from "@revorbit/queue";

import { env, redisConfig } from "@/config/env";

const redis = createRedis(redisConfig);

/**
 * Resolves the address a rate-limit bucket should be keyed on.
 *
 * `X-Forwarded-For` is attacker-controlled unless a trusted proxy is known to
 * overwrite it. Trusting it unconditionally means any client defeats the login
 * limit — the exact protection it exists to provide — by sending a fresh value
 * per request. It is therefore honoured only when `TRUST_PROXY` is set, and
 * otherwise the socket address is used.
 */
function clientKey(c: Parameters<MiddlewareHandler>[0]): string {
  if (env.TRUST_PROXY) {
    const forwarded = c.req.header("x-forwarded-for");

    if (forwarded) {
      // The left-most entry is the original client; every hop after it is
      // added by infrastructure we trust.
      const first = forwarded.split(",")[0]?.trim();

      if (first) {
        return first;
      }
    }

    const realIp = c.req.header("x-real-ip")?.trim();

    if (realIp) {
      return realIp;
    }
  }

  const incoming = (
    c.env as { incoming?: { socket?: { remoteAddress?: string } } }
  ).incoming;

  return incoming?.socket?.remoteAddress ?? "unknown";
}

interface LimiterOptions {
  windowMs: number;
  limit: number;
  message: string;
  prefix: string;
  /** Applies the limit only to these methods; defaults to all. */
  methods?: string[];
}

/**
 * Fixed-window counter in Redis, via `INCR` + conditional `PEXPIRE`.
 *
 * The window starts on the first request in it, so a caller cannot extend it by
 * continuing to send requests, and the two commands together mean a crash
 * between them can only leave a key without a TTL — never a permanent lockout.
 */
export function createRateLimiter({
  windowMs,
  limit,
  message,
  prefix,
  methods,
}: LimiterOptions): MiddlewareHandler {
  return async (c, next) => {
    if (methods && !methods.includes(c.req.method)) {
      return next();
    }

    const key = `rl:${prefix}:${clientKey(c)}`;

    try {
      const count = await redis.incr(key);

      if (count === 1) {
        await redis.pexpire(key, windowMs);
        c.header("X-RateLimit-Limit", String(limit));
        c.header("X-RateLimit-Remaining", String(limit - 1));
      } else if (count > limit) {
        const ttl = await redis.pttl(key);
        c.header("Retry-After", String(Math.max(1, Math.ceil(ttl / 1000))));
        c.header("X-RateLimit-Remaining", "0");

        return c.json(
          {
            success: false,
            error: { code: "RATE_LIMITED", message },
          },
          429,
        );
      } else {
        c.header("X-RateLimit-Remaining", String(limit - count));
      }
    } catch {
      // If Redis is unreachable the request is allowed through rather than
      // failing closed; availability is preferred over enforcement here, and
      // Redis is separately required for sessions.
    }

    return next();
  };
}

/**
 * Tighter limits on the credential endpoints than on ordinary API traffic:
 * `/auth/signup` costs a bcrypt hash per request, and `/auth/login` is a
 * password oracle.
 */
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Too many attempts. Please try again later.",
  prefix: "auth",
  methods: ["POST"],
});

export const apiRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  limit: 120,
  message: "Too many requests. Please slow down.",
  prefix: "api",
});
