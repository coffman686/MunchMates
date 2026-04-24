// api/comments/[id]/route.ts
// Single Comment API Route (DELETE)
// Requires authenticated user
//   DELETE: removes a comment the user authored. Rejects with 403 when the
//           caller is not the comment's author.
// Backed by Postgres via Prisma; data persists across server restarts.

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = String(p.sub);
        const { id } = await params;

        const comment = await prisma.comment.findUnique({ where: { id } });
        if (!comment) return errorResponse(404, "Comment not found");
        if (comment.userId !== userId) {
            return errorResponse(403, "Not authorized to delete this comment");
        }

        await prisma.comment.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return handleRouteError(error, "Error in DELETE /api/comments/[id]:");
    }
}
