import { Redis } from "ioredis";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: false,
    });

    redis.on("error", (err: Error) => {
      console.error("Redis error:", err.message);
    });

    redis.on("connect", () => {
      console.log("Connected to Redis");
    });

    return redis;
  } catch {
    console.warn("Failed to connect to Redis, using in-memory storage");
    return null;
  }
}

// generic helpers for JSON storage in redis with in-memory fallback
const memoryFallback = new Map<string, string>();

export async function redisGet<T>(key: string): Promise<T | undefined> {
  const r = getRedis();
  if (r) {
    const val = await r.get(key);
    return val ? (JSON.parse(val) as T) : undefined;
  }
  const val = memoryFallback.get(key);
  return val ? (JSON.parse(val) as T) : undefined;
}

export async function redisSet<T>(key: string, value: T): Promise<void> {
  const json = JSON.stringify(value);
  const r = getRedis();
  if (r) {
    await r.set(key, json);
  } else {
    memoryFallback.set(key, json);
  }
}

export async function redisDel(key: string): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.del(key);
  } else {
    memoryFallback.delete(key);
  }
}

export async function redisKeys(pattern: string): Promise<string[]> {
  const r = getRedis();
  if (r) {
    return r.keys(pattern);
  }
  return Array.from(memoryFallback.keys()).filter((k) =>
    new RegExp("^" + pattern.replace(/\*/g, ".*") + "$").test(k)
  );
}

export async function redisGetAll<T>(pattern: string): Promise<T[]> {
  const keys = await redisKeys(pattern);
  const results: T[] = [];
  for (const key of keys) {
    const val = await redisGet<T>(key);
    if (val) results.push(val);
  }
  return results;
}
