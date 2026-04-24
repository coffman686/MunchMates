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

        const existing = await prisma.postLike.findUnique({
            where: { postId_userId: { postId, userId } },
        });

        let liked: boolean;
        if (existing) {
            await prisma.postLike.delete({ where: { postId_userId: { postId, userId } } });
            liked = false;
        } else {
            await prisma.postLike.create({ data: { postId, userId } });
            liked = true;
        }

        const likeCount = await prisma.postLike.count({ where: { postId } });

        return NextResponse.json({ ok: true, liked, likeCount });
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/posts/[id]/like:");
    }
}
