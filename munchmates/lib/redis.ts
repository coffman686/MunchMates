import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL;
let nextConnectAttemptAt = 0;

declare global {
    var __redisClient: ReturnType<typeof createClient> | undefined;
    var __redisReady: boolean | undefined;
    var __redisConnecting: Promise<void> | undefined;
}

export const redis =
    global.__redisClient ??
    createClient({
        url: REDIS_URL,
        socket: {
            connectTimeout: 800,
            reconnectStrategy: (retries) => Math.min(retries * 50, 1000), // backoff up to 1s
        },
    });

if (process.env.NODE_ENV !== "production") {
    global.__redisClient = redis;
}

global.__redisReady ??= false;

redis.on("ready", () => {
    global.__redisReady = true;
});

redis.on("end", () => {
    global.__redisReady = false;
});

let lastRedisErrorLogAt = 0;
redis.on("error", (err) => {
    global.__redisReady = false;
    const now = Date.now();
    //log at most once every 5 seconds
    if (now - lastRedisErrorLogAt > 5000) {
        lastRedisErrorLogAt = now;
        console.warn("Redis Client Error:", err?.message ?? err);
    }
});

export function isRedisReady() {
    return Boolean(global.__redisReady);
}

export async function ensureRedisConnected(): Promise<void> {
    if (!REDIS_URL) {
        global.__redisReady = false;
        return;
    }
    if (isRedisReady()) return;

    const now = Date.now();
    if (now < nextConnectAttemptAt) return; // cooldown

    if (!global.__redisConnecting) {
        global.__redisConnecting = redis
            .connect()
            .then(() => {
                global.__redisReady = true;
            })
            .catch(() => {
                global.__redisReady = false;
                nextConnectAttemptAt = Date.now() + 5000; //wait 5s before next attempt
            })
            .finally(() => {
                global.__redisConnecting = undefined;
            });
    }
    function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error("Redis connect timeout")), ms);
            p.then((v) => {
                clearTimeout(t);
                resolve(v);
            }).catch((e) => {
                clearTimeout(t);
                reject(e);
            });
        });
    }

    try {
        await withTimeout(global.__redisConnecting, 900);
    } catch {
        //redis is optional
        global.__redisReady = false;
    }
}