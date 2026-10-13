import dotenv from "dotenv";
import { z } from "zod";

import { getRepoRootEnvPath } from "@revorbit/shared";

dotenv.config({
  path: getRepoRootEnvPath(),
});

/**
 * A bare string for these would let a typo such as "localhost:3001" pass
 * validation and only fail at runtime inside the OAuth redirect.
 */
const urlString = z.string().url();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  /** Bound address passed to the node server. */
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default("/api/v1"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  CORS_ORIGIN: z.string(),

  WEB_ORIGIN: urlString,

  GITHUB_OAUTH_REDIRECT_URI: urlString,

  DATABASE_URL: z.string().min(1),

  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional(),
  REDIS_USERNAME: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z
    .string()
    .optional()
    .transform((value) => value === "true"),

  /**
   * Signs the session identifier so a value leaked from Redis cannot be
   * replayed as a cookie without this key.
   */
  SESSION_SECRET: z.string().min(16),
  SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 7),

  GITHUB_APP_ID: z.coerce.number(),

  GITHUB_CLIENT_ID: z.string(),

  GITHUB_CLIENT_SECRET: z.string(),

  GITHUB_PRIVATE_KEY: z.string().optional(),
  GITHUB_PRIVATE_KEY_PATH: z.string().optional(),

  GITHUB_WEBHOOK_SECRET: z.string().min(1),

  /** Password-reset delivery. When unset in development, mail is logged. */
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("Revorbit <noreply@revorbit.dev>"),

  /** Maximum accepted request body, in bytes. */
  MAX_BODY_BYTES: z.coerce.number().int().positive().default(100_000),

  /**
   * Model assigned to newly connected repositories when the account has no
   * explicit preference. Mirrors the worker's `AI_MODEL` so a fresh repository
   * uses the same model the worker is actually configured with, rather than a
   * hardcoded default the provider may not serve.
   */
  AI_MODEL: z.string().min(1).optional(),

  /**
   * Set only when running behind a proxy that overwrites `X-Forwarded-For`
   * (Nginx, a cloud load balancer). When false the header is ignored for rate
   * limiting, because a client can otherwise choose its own bucket.
   */
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment variables:", parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;

export const redisConfig = {
  url: env.REDIS_URL,
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  username: env.REDIS_USERNAME,
  password: env.REDIS_PASSWORD,
  tls: env.REDIS_TLS,
};
