// app/api/grocery/clear/route.ts
// Endpoint for bulk grocery list operations (clear completed, clear all)
// Backed by Postgres via Prisma — data persists across server restarts

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";

// POST /api/grocery/clear — Bulk operations
// Body: { action: "completed" } — Clear all completed items
// Body: { action: "all" } — Clear entire list
export async function POST(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const body = await req.json();

        if (!body.action || !["completed", "all"].includes(body.action)) {
            return errorResponse(400, "Missing or invalid action. Use 'completed' or 'all'");
        }

        let result;

        if (body.action === "completed") {
            // Delete only completed items
            result = await prisma.groceryItem.deleteMany({
                where: { userId: p.sub, completed: true },
            });

            return NextResponse.json({
                ok: true,
                message: "Completed items cleared",
                deletedCount: result.count,
            });
        } else {
            // Delete all items
            result = await prisma.groceryItem.deleteMany({
                where: { userId: p.sub },
            });

            return NextResponse.json({
                ok: true,
                message: "All items cleared",
                deletedCount: result.count,
            });
        }
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/grocery/clear:");
    }
}
