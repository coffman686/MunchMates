// app/api/users/search/route.ts
// Endpoint to search registered users by name or username
// Used by shared collection member invite flow

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBearer } from "@/lib/verifyToken";
import { handleRouteError, errorResponse } from "@/lib/apiErrors";
import { rateLimiter } from "@/lib/rateLimiter";

// GET /api/users/search?q=<query> — Search users by name or username
export async function GET(req: NextRequest) {
    try {
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
        const { success } = await rateLimiter.limit(ip);
        if (!success) {
            return errorResponse(429, "Too Many Requests");
        }
        const p = await verifyBearer(req.headers.get("authorization") || undefined);

        const query = req.nextUrl.searchParams.get("q")?.trim();
        if (!query || query.length < 2) {
            return NextResponse.json({ users: [] });
        }

        const users = await prisma.user.findMany({
            where: {
                AND: [
                    { id: { not: p.sub } }, // Exclude requesting user
                    {
                        OR: [
                            { name: { contains: query, mode: "insensitive" } },
                            { username: { contains: query, mode: "insensitive" } },
                        ],
                    },
                ],
            },
            select: { id: true, name: true, username: true },
            take: 10,
        });

        return NextResponse.json({ users });
    } catch (error) {
        return handleRouteError(error, "Error in GET /api/users/search:");
    }
}
