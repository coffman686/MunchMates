// app/api/users/search/route.ts
// Endpoint to search registered users by name or username
// Used by shared collection member invite flow

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBearer } from "@/lib/verifyToken";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";

// GET /api/users/search?q=<query> — Search users by name or username
export async function GET(req: NextRequest) {
    try {
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
