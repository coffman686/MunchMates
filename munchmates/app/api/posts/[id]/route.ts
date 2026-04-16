// api/posts/[id]/route.ts
// Single Post API Route (DELETE)
// Requires authenticated user
//   DELETE: removes a post the user authored. Comments and munches for the
//           post are removed automatically via cascade delete.
// Backed by Postgres via Prisma; data persists across server restarts.

import { type NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { prisma } from "@/lib/prisma";
import { verifyBearer } from "@/lib/verifyToken";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const p = await verifyBearer(req.headers.get("authorization") || undefined);
    const userId = String(p.sub);
    const { id } = await params;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return errorResponse(404, "Post not found");
    if (post.userId !== userId) return errorResponse(403, "Not authorized to delete this post");

    await prisma.post.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Error in DELETE /api/posts/[id]:");
  }
}
