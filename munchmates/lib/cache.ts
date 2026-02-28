import crypto from 'crypto';
import { redis, ensureRedisConnected, isRedisReady } from './redis';

export type CacheOptions = {
    ttlSeconds: number;
    prefix?: string;
};

type CacheEnvelope<T> = {
    cachedAt: number; // epoch ms
    data: T;
};

export function stableKey(prefix: string, endpoint: string, params: Record<string, unknown>) {
    //Sort params to avoid key changes due to object ordering
    const sortedParams = Object.keys(params)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = params[k];
            return acc;
        }, {});

    const raw = JSON.stringify({ endpoint, sortedParams });
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return `${prefix}:${hash}`;
}

export async function getOrSetJsonSWR<T>(
    key: string,
    freshForSeconds: number, // soft TTL
    staleForSeconds: number, // hard TTL (must be > freshForSeconds)
    fetcher: () => Promise<T>
): Promise<T> {
    if (staleForSeconds <= freshForSeconds) {
        throw new Error('staleForSeconds must be greater than freshForSeconds');
    }

    try {
        await ensureRedisConnected();
        if (!isRedisReady()) {
            return fetcher();
        }
        const now = Date.now();
        const cachedRaw = await redis.get(key);

        if (cachedRaw) {
            const envelope = JSON.parse(cachedRaw) as CacheEnvelope<T>;
            const ageSeconds = (now - envelope.cachedAt) / 1000;

            //Fresh: return immediately
            if (ageSeconds <= freshForSeconds) {
                return envelope.data;
            }

            //Stale-but-allowed: return immediately, refresh in background (once)
            if (ageSeconds <= staleForSeconds) {
                const lockKey = `${key}:refresh_lock`;

                //acquire refresh lock for 30s to avoid stampede
                const gotLock = await redis.set(lockKey, '1', { NX: true, EX: 30 });

                if (gotLock) {
                    //fire-and-forget refresh
                    void (async () => {
                        try {
                            const fresh = await fetcher();
                            const newEnvelope: CacheEnvelope<T> = {
                                cachedAt: Date.now(),
                                data: fresh,
                            };
                            await redis.set(key, JSON.stringify(newEnvelope), {
                                EX: staleForSeconds,
                            });
                        } catch {
                            //ignore refresh errors (don't break responses)
                        } finally {
                            await redis.del(lockKey).catch(() => {});
                        }
                    })();
                }

                return envelope.data;
            }

            //Too old: fall through and fetch synchronously
        }

        //Cache miss or expired beyond hard limit: fetch now
        const fresh = await fetcher();
        const envelope: CacheEnvelope<T> = { cachedAt: Date.now(), data: fresh };
        await redis.set(key, JSON.stringify(envelope), { EX: staleForSeconds });
        return fresh;
    } catch (err) {
        //Redis is down/unreachable — bypass cache completely
        console.warn('Redis unavailable; bypassing cache:', (err as any)?.message ?? err);
        return fetcher();
    }
}