// api/posts/[id]/like/route.ts
// Post Munch (Like) API Route (POST)
// Toggles the authenticated user's munch on a post.
//   POST: adds a PostLike row if none exists, otherwise removes it. Returns
//         the resulting liked state and the post's new munch count so the
//         client can reconcile its optimistic update.
// Backed by Postgres via Prisma; data persists across server restarts.

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = String(p.sub);
        const { id: postId } = await params;

        const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
        if (!post) return errorResponse(404, "Post not found");

        await prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: { id: userId, name: p.name ?? "", username: p.preferred_username ?? "" },
        });

        const [{ count: deleted }, likeCount] = await prisma.$transaction(async (tx) => {
            const del = await tx.postLike.deleteMany({ where: { postId, userId } });
            if (del.count === 0) {
                await tx.postLike.create({ data: { postId, userId } });
            }
            const total = await tx.postLike.count({ where: { postId } });
            return [del, total] as const;
        });
        const liked = deleted === 0;

        return NextResponse.json({ ok: true, liked, likeCount });
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/posts/[id]/like:");
    }
}
