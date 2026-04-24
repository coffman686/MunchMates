// api/posts/[id]/comments/route.ts
// Post Comments API Route (GET / POST)
// Manages the comment thread for a single community post.
// GET  → Returns all comments on the post, oldest first, with author info.
// POST → Adds a new comment authored by the current user.
// Backed by Postgres via Prisma; data persists across server restarts.

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";

const MAX_COMMENT_LEN = 1000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await verifyBearer(req.headers.get("authorization") || undefined);
        const { id: postId } = await params;

        const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
        if (!post) return errorResponse(404, "Post not found");

        const comments = await prisma.comment.findMany({
            where: { postId },
            orderBy: { createdAt: "asc" },
            include: { user: { select: { id: true, name: true, username: true } } },
        });

        return NextResponse.json({
            ok: true,
            comments: comments.map((c) => ({
                id: c.id,
                text: c.text,
                createdAt: c.createdAt.toISOString(),
                author: { id: c.user.id, name: c.user.name, username: c.user.username },
            })),
        });
    } catch (error) {
        return handleRouteError(error, "Error in GET /api/posts/[id]/comments:");
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = String(p.sub);
        const { id: postId } = await params;

        const body = await req.json().catch(() => null);
        const text = typeof body?.text === "string" ? body.text.trim() : "";
        if (!text) return errorResponse(400, "Comment text is required");
        if (text.length > MAX_COMMENT_LEN) {
            return errorResponse(400, `Comment must be ${MAX_COMMENT_LEN} characters or fewer`);
        }

        const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
        if (!post) return errorResponse(404, "Post not found");

        await prisma.user.upsert({
            where: { id: userId },
            update: { name: p.name ?? "", username: p.preferred_username ?? "" },
            create: { id: userId, name: p.name ?? "", username: p.preferred_username ?? "" },
        });

        const created = await prisma.comment.create({
            data: { postId, userId, text },
            include: { user: { select: { id: true, name: true, username: true } } },
        });

        return NextResponse.json(
            {
                ok: true,
                comment: {
                    id: created.id,
                    text: created.text,
                    createdAt: created.createdAt.toISOString(),
                    author: {
                        id: created.user.id,
                        name: created.user.name,
                        username: created.user.username,
                    },
                },
            },
            { status: 201 },
        );
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/posts/[id]/comments:");
    }
}
