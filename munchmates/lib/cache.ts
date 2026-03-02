import crypto from 'crypto';
import { redis, ensureRedisConnected, isRedisReady } from './redis';

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

function parseEnvelope<T>(key: string, raw: string): CacheEnvelope<T> | null {
    try {
        return JSON.parse(raw) as CacheEnvelope<T>;
    } catch (err) {
        console.warn(`Corrupted cache entry for key ${key}, deleting:`, (err as Error).message);
        redis.del(key).catch(() => {});
        return null;
    }
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

    // Try to read from cache
    let cachedRaw: string | null = null;
    try {
        await ensureRedisConnected();
        if (!isRedisReady()) {
            return fetcher();
        }
        cachedRaw = await redis.get(key);
    } catch (err) {
        console.warn('Redis read failed; bypassing cache:', (err as Error)?.message ?? err);
        return fetcher();
    }

    if (cachedRaw) {
        const envelope = parseEnvelope<T>(key, cachedRaw);
        if (envelope) {
            const ageSeconds = (Date.now() - envelope.cachedAt) / 1000;

            //Fresh: return immediately
            if (ageSeconds <= freshForSeconds) {
                return envelope.data;
            }

            //Stale-but-allowed: return immediately, refresh in background (once)
            if (ageSeconds <= staleForSeconds) {
                const lockKey = `${key}:refresh_lock`;

                try {
                    const gotLock = await redis.set(lockKey, '1', { NX: true, EX: 30 });

                    if (gotLock) {
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
                            } catch (err) {
                                console.warn(`SWR background refresh failed for ${key}:`, (err as Error)?.message ?? err);
                            } finally {
                                await redis.del(lockKey).catch((err) => {
                                    console.warn(`Failed to release refresh lock ${lockKey}:`, (err as Error)?.message);
                                });
                            }
                        })();
                    }
                } catch (err) {
                    console.warn('Redis lock acquisition failed:', (err as Error)?.message ?? err);
                }

                return envelope.data;
            }

            //Too old: fall through to synchronous fetch
        }
    }

    //Cache miss, corrupted, or expired beyond hard limit: fetch now
    const fresh = await fetcher();

    // Try to write to cache (don't let a Redis write failure lose the fetched data)
    try {
        const envelope: CacheEnvelope<T> = { cachedAt: Date.now(), data: fresh };
        await redis.set(key, JSON.stringify(envelope), { EX: staleForSeconds });
    } catch (err) {
        console.warn('Redis write failed:', (err as Error)?.message ?? err);
    }

    return fresh;
}
