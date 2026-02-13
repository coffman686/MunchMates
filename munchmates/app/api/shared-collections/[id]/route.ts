// shared-collections/[id]/route.ts
// Endpoints to retrieve, update, and manage a recipe collection
// This pertains specifically to accessing and modifying individual collections
// Requires authenticated user
//   GET: retrieves collection information
//   PUT: handles updating collection information, recipe addition, recipe removal
//   DELETE: allows user to leave a collection (owner deletes, non-owner leaves)
// Backed by Postgres via Prisma — data persists across server restarts.

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";
import { formatCollection } from "@/lib/formatCollection";

type RouteContext = {
    params: Promise<{ id: string }>;
};

// GET - Get a specific collection by ID
export async function GET(req: NextRequest, context: RouteContext) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;
        const { id: collectionId } = await context.params;

        const collection = await prisma.sharedCollection.findUnique({
            where: { id: collectionId },
            include: { members: true, recipes: true },
        });

        if (!collection) {
            return errorResponse(404, "Collection not found");
        }

        const isMember = collection.members.some(m => m.userId === userId);
        if (!isMember) {
            return errorResponse(403, "You don't have access to this collection");
        }

        return NextResponse.json({
            ok: true,
            collection: formatCollection(collection),
        });
    } catch (error) {
        return handleRouteError(error, "Error in GET /api/shared-collections/[id]:");
    }
}

// PUT - Update collection (name, description) or add/remove recipes
export async function PUT(req: NextRequest, context: RouteContext) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;
        const userName = p.preferred_username || p.name || 'Unknown User';
        const { id: collectionId } = await context.params;

        const collection = await prisma.sharedCollection.findUnique({
            where: { id: collectionId },
            include: { members: true, recipes: true },
        });

        if (!collection) {
            return errorResponse(404, "Collection not found");
        }

        // Check if user is a member with edit rights
        const userMember = collection.members.find(m => m.userId === userId);
        if (!userMember || userMember.role === 'viewer') {
            return errorResponse(403, "You don't have permission to edit this collection");
        }

        const body = await req.json();
        const { action, name, description, recipeId, recipeName } = body;

        switch (action) {
            case 'update': {
                const updateData: { name?: string; description?: string } = {};
                if (name !== undefined) updateData.name = name.trim();
                if (description !== undefined) updateData.description = description.trim();

                const updated = await prisma.sharedCollection.update({
                    where: { id: collectionId },
                    data: updateData,
                    include: { members: true, recipes: true },
                });

                return NextResponse.json({
                    ok: true,
                    message: "Collection updated successfully",
                    collection: formatCollection(updated),
                });
            }

            case 'addRecipe': {
                if (!recipeId || !recipeName) {
                    return errorResponse(400, "recipeId and recipeName are required");
                }

                // Check if recipe already exists in collection
                const existingRecipe = collection.recipes.find(r => r.recipeId === recipeId);
                if (existingRecipe) {
                    return NextResponse.json(
                        { message: "Recipe is already in this collection" },
                        { status: 200 }
                    );
                }

                await prisma.collectionRecipe.create({
                    data: {
                        collectionId,
                        recipeId,
                        recipeName,
                        addedBy: userId,
                        addedByName: userName,
                    },
                });

                const updated = await prisma.sharedCollection.findUnique({
                    where: { id: collectionId },
                    include: { members: true, recipes: true },
                });

                return NextResponse.json({
                    ok: true,
                    message: "Collection updated successfully",
                    collection: formatCollection(updated!),
                });
            }

            case 'removeRecipe': {
                if (!recipeId) {
                    return errorResponse(400, "recipeId is required");
                }

                const existingRecipe = collection.recipes.find(r => r.recipeId === recipeId);
                if (!existingRecipe) {
                    return errorResponse(404, "Recipe not found in collection");
                }

                await prisma.collectionRecipe.delete({
                    where: { collectionId_recipeId: { collectionId, recipeId } },
                });

                const updated = await prisma.sharedCollection.findUnique({
                    where: { id: collectionId },
                    include: { members: true, recipes: true },
                });

                return NextResponse.json({
                    ok: true,
                    message: "Collection updated successfully",
                    collection: formatCollection(updated!),
                });
            }

            default:
                return errorResponse(400, "Invalid action. Use 'update', 'addRecipe', or 'removeRecipe'");
        }
    } catch (error) {
        return handleRouteError(error, "Error updating collection:");
    }
}

// DELETE - Remove user from collection or delete collection
export async function DELETE(req: NextRequest, context: RouteContext) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;
        const { id: collectionId } = await context.params;

        const collection = await prisma.sharedCollection.findUnique({
            where: { id: collectionId },
            include: { members: true },
        });

        if (!collection) {
            return errorResponse(404, "Collection not found");
        }

        const userMember = collection.members.find(m => m.userId === userId);
        if (!userMember) {
            return errorResponse(403, "You are not a member of this collection");
        }

        if (userMember.role === 'owner') {
            // Owner deletes the entire collection (cascade handles members + recipes)
            await prisma.sharedCollection.delete({
                where: { id: collectionId },
            });
            return NextResponse.json({
                ok: true,
                message: "Collection deleted successfully",
            });
        } else {
            // Non-owner leaves the collection
            await prisma.collectionMember.delete({
                where: { collectionId_userId: { collectionId, userId } },
            });
            return NextResponse.json({
                ok: true,
                message: "You have left the collection",
            });
        }
    } catch (error) {
        return handleRouteError(error, "Error in DELETE /api/shared-collections/[id]:");
    }
}
