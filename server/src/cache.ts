import { Redis } from "ioredis";

const parseEnvNumber = (
  rawValue: string | undefined,
  fallback: number,
  envName: string,
): number => {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${envName} must be an integer`);
  }

  return parsed;
};

const explicitRedisConfigProvided =
  process.env.REDIS_HOST !== undefined ||
  process.env.REDIS_PORT !== undefined ||
  process.env.REDIS_USERNAME !== undefined ||
  process.env.REDIS_PASSWORD !== undefined ||
  process.env.REDIS_DB !== undefined;

const redisUrl = process.env.REDIS_URL;

export const cache = redisUrl
  ? new Redis(redisUrl)
  : explicitRedisConfigProvided
    ? new Redis({
        host: process.env.REDIS_HOST ?? "127.0.0.1",
        port: parseEnvNumber(process.env.REDIS_PORT, 6379, "REDIS_PORT"),
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        db: parseEnvNumber(process.env.REDIS_DB, 0, "REDIS_DB"),
      })
    : new Redis("redis://127.0.0.1:6379/0");
