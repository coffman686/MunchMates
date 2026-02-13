// Saved Recipes API Route (POST / GET / DELETE)
// Provides per-user saved-recipe management using Bearer-token authentication.
// POST   → Saves a new recipe for the authenticated user (id, name, optional image).
// GET    → Returns all saved recipes for the requesting user.
// DELETE → Removes a specific saved recipe using ?recipeId=.
// Backed by Postgres via Prisma — data persists across server restarts.

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;

        const body = await req.json();
        const { recipeId, recipeName, recipeImage } = body;

        if (!recipeId || !recipeName) {
            return errorResponse(400, "Missing required fields: recipeId and recipeName");
        }

        // Check if recipe is already saved
        const existing = await prisma.savedRecipe.findUnique({
            where: { userId_recipeId: { userId, recipeId } },
        });

        if (existing) {
            return NextResponse.json(
                { message: "Recipe is already saved" },
                { status: 200 }
            );
        }

        // Ensure User record exists
        await prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: { id: userId },
        });

        const newSavedRecipe = await prisma.savedRecipe.create({
            data: { userId, recipeId, recipeName, recipeImage: recipeImage || null },
        });

        return NextResponse.json(
            {
                ok: true,
                message: "Recipe saved successfully",
                recipe: {
                    userId: newSavedRecipe.userId,
                    recipeId: newSavedRecipe.recipeId,
                    recipeName: newSavedRecipe.recipeName,
                    recipeImage: newSavedRecipe.recipeImage,
                    savedAt: newSavedRecipe.savedAt.toISOString(),
                },
            },
            { status: 201 }
        );
    } catch (error) {
        return handleRouteError(error, "Error saving recipe:");
    }
}

// GET endpoint to retrieve user's saved recipes
export async function GET(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;

        const recipes = await prisma.savedRecipe.findMany({
            where: { userId },
        });

        return NextResponse.json({
            ok: true,
            recipes: recipes.map((r) => ({
                userId: r.userId,
                recipeId: r.recipeId,
                recipeName: r.recipeName,
                recipeImage: r.recipeImage,
                savedAt: r.savedAt.toISOString(),
            })),
            count: recipes.length,
        });
    } catch (error) {
        return handleRouteError(error, "Error in GET /api/recipes/saved:");
    }
}

// DELETE endpoint to remove a saved recipe
export async function DELETE(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;

        const searchParams = req.nextUrl.searchParams;
        const recipeId = searchParams.get("recipeId");

        if (!recipeId) {
            return errorResponse(400, "Missing recipeId parameter");
        }

        const deleted = await prisma.savedRecipe.deleteMany({
            where: { userId, recipeId: parseInt(recipeId) },
        });

        if (deleted.count === 0) {
            return errorResponse(404, "Recipe not found in saved recipes");
        }

        return NextResponse.json({
            ok: true,
            message: "Recipe removed from saved recipes",
        });
    } catch (error) {
        return handleRouteError(error, "Error in DELETE /api/recipes/saved:");
    }
}
