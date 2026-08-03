import { Redis as IORedis } from "ioredis";

export interface RedisConnectionConfig {
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  tls?: boolean;
}

export function createRedis(config: RedisConnectionConfig): IORedis {
  const baseOptions = {
    maxRetriesPerRequest: null,
  };

  if (config.url) {
    return new IORedis(config.url, baseOptions);
  }

  return new IORedis({
    ...baseOptions,
    ...(config.host ? { host: config.host, port: config.port } : {}),
    ...(config.username ? { username: config.username } : {}),
    ...(config.password ? { password: config.password } : {}),
    ...(config.tls ? { tls: {} } : {}),
  });
}

export type Redis = IORedis;
