// shared-collections/route.ts
// Endpoints to retrieve and manage collections of recipes
// This pertains to managing the list of collections a user holds
// Requires authenticated user
//   GET: retrieves all collections the user has created or joined
//   POST: creates a new collection
//   DELETE: deletes collection itself
// Backed by Postgres via Prisma — data persists across server restarts.

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";
import { formatCollection } from "@/lib/formatCollection";

// GET - List all collections the user is a member of
export async function GET(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;

        const collections = await prisma.sharedCollection.findMany({
            where: { members: { some: { userId } } },
            include: { members: true, recipes: true },
        });

        return NextResponse.json({
            ok: true,
            collections: collections.map(formatCollection),
            count: collections.length,
        });
    } catch (error) {
        return handleRouteError(error, "Error in GET /api/shared-collections:");
    }
}

// POST - Create a new shared collection
export async function POST(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;
        const userName = p.preferred_username || p.name || 'Unknown User';

        const body = await req.json();
        const { name, description } = body;

        if (!name || name.trim() === '') {
            return errorResponse(400, "Collection name is required");
        }

        // Ensure User record exists
        await prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: { id: userId },
        });

        const collection = await prisma.sharedCollection.create({
            data: {
                name: name.trim(),
                description: description?.trim() || '',
                createdBy: userId,
                createdByName: userName,
                members: {
                    create: {
                        userId,
                        userName,
                        role: 'owner',
                    },
                },
            },
            include: { members: true, recipes: true },
        });

        return NextResponse.json(
            {
                ok: true,
                message: "Collection created successfully",
                collection: formatCollection(collection),
            },
            { status: 201 }
        );
    } catch (error) {
        return handleRouteError(error, "Error creating collection:");
    }
}

// DELETE - Delete a collection (owner only)
export async function DELETE(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;

        const collectionId = req.nextUrl.searchParams.get("collectionId");

        if (!collectionId) {
            return errorResponse(400, "Missing collectionId parameter");
        }

        const collection = await prisma.sharedCollection.findUnique({
            where: { id: collectionId },
            include: { members: true },
        });

        if (!collection) {
            return errorResponse(404, "Collection not found");
        }

        const userMember = collection.members.find(m => m.userId === userId);
        if (!userMember || userMember.role !== 'owner') {
            return errorResponse(403, "Only the owner can delete this collection");
        }

        // Cascade delete handles members and recipes
        await prisma.sharedCollection.delete({
            where: { id: collectionId },
        });

        return NextResponse.json({
            ok: true,
            message: "Collection deleted successfully",
        });
    } catch (error) {
        return handleRouteError(error, "Error in DELETE /api/shared-collections:");
    }
}
