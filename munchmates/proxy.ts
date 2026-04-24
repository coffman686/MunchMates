import { redis, ensureRedisConnected } from "@/lib/redis";
import { type NextProxy, NextResponse } from "next/server";
import { errorResponse } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";

// Fixed window rate limiter: 100 requests per 10 seconds per IP
async function rateLimiter(ip: string, limit = 100, windowSec = 10) {
  await ensureRedisConnected();
  const key = `rate_limit:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }
  const ttl = await redis.ttl(key);
  return {
    success: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    reset: ttl,
  };
}

export const proxy: NextProxy = async (req, event) => {
  // Rate limiting by IP address
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
  const { success, limit, remaining, reset } = await rateLimiter(ip);
  if (!success) {
    return errorResponse(429, "Too Many Requests");
  }
  // Server-side Keycloak token verification
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  try {
    // Throws if missing/invalid
    await verifyBearer(authHeader ?? undefined);
  } catch (err) {
    return errorResponse(401, "Unauthorized");
  }
  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", limit.toString());
  res.headers.set("X-RateLimit-Remaining", remaining.toString());
  res.headers.set("X-RateLimit-Reset", reset.toString());
  return res;
}

export const config = {
  // matches everything under /api/
  matcher: "/api/:path*",
}