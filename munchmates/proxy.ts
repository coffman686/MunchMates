import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { type NextProxy, NextResponse } from "next/server";
import { errorResponse } from "@/lib/apiErrors";
import { keycloak, waitForInit } from "./lib/keycloak";
import { verifyBearer } from "@/lib/verifyToken";

const redis = Redis.fromEnv();

export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(100, "10s"), // 10 requests per 10 seconds
  analytics: true,
});

export const proxy: NextProxy = async (req, event) => {
    // Rate limiting by IP address
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
    const { success, limit, pending, remaining } = await rateLimiter.limit(ip);
    event.waitUntil(pending);
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
    return res;
}

export const config = {
  // matches everything under /api/
  matcher: "/api/:path*",
}