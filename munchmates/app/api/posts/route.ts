// api/posts/route.ts
// Community Feed API Route (GET / POST)
// Provides the global community feed and new-post creation.
// GET  → Returns all posts newest-first, each enriched with the author,
//        munch count, comment count, and whether the current user has
//        already munched the post.
// POST → Creates a new post for the authenticated user. A post requires a
//        caption and may optionally include an uploaded image, a recipe
//        reference (Spoonacular or custom) with cached name/image, and a
//        1-5 star rating when a recipe is attached.
// Backed by Postgres via Prisma; data persists across server restarts.

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";

const MAX_CAPTION_LEN = 2000;

function safeUploadUrl(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.startsWith("/uploads/") ? trimmed : null;
}

export async function GET(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = String(p.sub);

        const posts = await prisma.post.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { id: true, name: true, username: true } },
                _count: { select: { comments: true, likes: true } },
                likes: { where: { userId }, select: { userId: true } },
            },
        });

        return NextResponse.json({
            ok: true,
            posts: posts.map((post) => ({
                id: post.id,
                caption: post.caption,
                image: post.image,
                recipeId: post.recipeId,
                recipeType: post.recipeType,
                recipeName: post.recipeName,
                recipeImage: post.recipeImage,
                rating: post.rating,
                createdAt: post.createdAt.toISOString(),
                author: {
                    id: post.user.id,
                    name: post.user.name,
                    username: post.user.username,
                },
                likeCount: post._count.likes,
                commentCount: post._count.comments,
                likedByMe: post.likes.length > 0,
            })),
        });
    } catch (error) {
        return handleRouteError(error, "Error in GET /api/posts:");
    }
}

export async function POST(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = String(p.sub);

        const body = await req.json().catch(() => null);
        const caption = typeof body?.caption === "string" ? body.caption.trim() : "";
        if (!caption) return errorResponse(400, "Caption is required");
        if (caption.length > MAX_CAPTION_LEN) {
            return errorResponse(400, `Caption must be ${MAX_CAPTION_LEN} characters or fewer`);
        }

        if (body?.image != null && safeUploadUrl(body.image) === null) {
            return errorResponse(400, "Invalid image URL");
        }
        const image = safeUploadUrl(body?.image);

        let recipeId: number | null = null;
        let recipeType: string | null = null;
        let recipeName: string | null = null;
        let recipeImage: string | null = null;
        let rating: number | null = null;

        if (body?.recipeId != null) {
            const rId = Number(body.recipeId);
            const rType = typeof body?.recipeType === "string" ? body.recipeType : "";
            const rName = typeof body?.recipeName === "string" ? body.recipeName.trim() : "";
            if (!Number.isFinite(rId) || rId <= 0) {
                return errorResponse(400, "Invalid recipeId");
            }
            if (rType !== "spoonacular" && rType !== "custom") {
                return errorResponse(400, "recipeType must be 'spoonacular' or 'custom'");
            }
            if (!rName) return errorResponse(400, "recipeName is required when recipeId is set");

            recipeId = rId;
            recipeType = rType;
            recipeName = rName;
            recipeImage =
                typeof body?.recipeImage === "string" && body.recipeImage.trim() !== ""
                    ? body.recipeImage.trim()
                    : null;

            if (body?.rating != null) {
                const r = Number(body.rating);
                if (!Number.isInteger(r) || r < 1 || r > 5) {
                    return errorResponse(400, "Rating must be an integer between 1 and 5");
                }
                rating = r;
            }
        }

        await prisma.user.upsert({
            where: { id: userId },
            update: { name: p.name ?? "", username: p.preferred_username ?? "" },
            create: { id: userId, name: p.name ?? "", username: p.preferred_username ?? "" },
        });

        const created = await prisma.post.create({
            data: {
                userId,
                caption,
                image,
                recipeId,
                recipeType,
                recipeName,
                recipeImage,
                rating,
            },
            include: {
                user: { select: { id: true, name: true, username: true } },
            },
        });

        return NextResponse.json(
            {
                ok: true,
                post: {
                    id: created.id,
                    caption: created.caption,
                    image: created.image,
                    recipeId: created.recipeId,
                    recipeType: created.recipeType,
                    recipeName: created.recipeName,
                    recipeImage: created.recipeImage,
                    rating: created.rating,
                    createdAt: created.createdAt.toISOString(),
                    author: {
                        id: created.user.id,
                        name: created.user.name,
                        username: created.user.username,
                    },
                    likeCount: 0,
                    commentCount: 0,
                    likedByMe: false,
                },
            },
            { status: 201 },
        );
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/posts:");
    }
}
