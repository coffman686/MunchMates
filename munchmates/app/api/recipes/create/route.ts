// Custom Recipe API Route (POST / GET)
// Allows authenticated users to create and retrieve their own custom recipes.
// POST → Validates required fields (title, ingredients, instructions), auto-generates
//        a unique high-range ID (starting at 100000), and stores in Postgres.
// GET  → Returns all custom recipes for the authenticated user, or a single recipe
//        by ID via the ?id= query param (no auth required for single lookups).
// Backed by Postgres via Prisma — data persists across server restarts.
// Uses mapToRecipeInfo() to convert DB rows into the RecipeInfo shape the UI expects,
// mapping the ingredients string array into the extendedIngredients format.

import { NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;

        const body = await req.json();
        const { title, servings, readyInMinutes, dishTypes, cuisines, ingredients, instructions } = body;

        // Validate required fields
        if (!title || typeof title !== 'string' || !title.trim()) {
            return NextResponse.json(
                { error: "Recipe title is required" },
                { status: 400 }
            );
        }

        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            return NextResponse.json(
                { error: "At least one ingredient is required" },
                { status: 400 }
            );
        }

        if (!instructions || typeof instructions !== 'string' || !instructions.trim()) {
            return NextResponse.json(
                { error: "Instructions are required" },
                { status: 400 }
            );
        }

        // Ensure User record exists
        await prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: { id: userId },
        });

        const newRecipe = await prisma.customRecipe.create({
            data: {
                userId,
                title: title.trim(),
                servings: servings || 1,
                readyInMinutes: readyInMinutes || 30,
                dishTypes: dishTypes || ['main course'],
                cuisines: cuisines || ['American'],
                ingredients,
                instructions: instructions.trim(),
            },
        });

        // Match original response shape
        const recipe = {
            id: newRecipe.id,
            userId: newRecipe.userId,
            title: newRecipe.title,
            servings: newRecipe.servings,
            readyInMinutes: newRecipe.readyInMinutes,
            dishTypes: newRecipe.dishTypes,
            cuisines: newRecipe.cuisines,
            ingredients: newRecipe.ingredients,
            instructions: newRecipe.instructions,
            createdAt: newRecipe.createdAt.toISOString(),
            image: newRecipe.image ?? undefined,
        };

        return NextResponse.json(
            {
                ok: true,
                message: "Recipe created successfully",
                id: newRecipe.id,
                recipe,
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof Error && error.message === "no token") {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error creating recipe:", error);
        return NextResponse.json(
            { error: "Failed to create recipe" },
            { status: 500 }
        );
    }
}

// Helper: map a DB CustomRecipe row to the RecipeInfo shape the UI expects
// Converts the flat ingredients string array into the extendedIngredients format
// used by both RecipeDetailPage and RecipeDetails (slideover) components.
// Custom recipes store ingredients as plain strings (e.g. "2 cups flour"),
// so amount/unit are left at defaults and the full string goes in name + original.
function mapToRecipeInfo(r: {
    id: number;
    title: string;
    image: string | null;
    readyInMinutes: number;
    servings: number;
    cuisines: string[];
    dishTypes: string[];
    ingredients: string[];
    instructions: string;
}) {
    return {
        id: r.id,
        title: r.title,
        image: r.image ?? undefined,
        readyInMinutes: r.readyInMinutes,
        servings: r.servings,
        cuisines: r.cuisines,
        dishTypes: r.dishTypes,
        instructions: r.instructions,
        extendedIngredients: r.ingredients.map((name, index) => ({
            id: index,
            name,
            amount: 0,
            unit: "",
            original: name,
        })),
    };
}

// GET endpoint to retrieve custom recipes
// Supports two modes:
//   ?id=<recipeId> → returns a single recipe mapped to RecipeInfo (no auth required)
//   (no params)    → returns all recipes for the authenticated user (auth required)
// Single-recipe mode is used by the detail page and slideover when recipeId >= 100000
export async function GET(req: NextRequest) {
    try {
        const singleId = req.nextUrl.searchParams.get("id");

        // Single recipe lookup by ID — used by detail views for custom recipes
        if (singleId) {
            const id = parseInt(singleId, 10);
            if (isNaN(id)) {
                return NextResponse.json({ error: "Invalid recipe ID" }, { status: 400 });
            }

            const recipe = await prisma.customRecipe.findUnique({ where: { id } });
            if (!recipe) {
                return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
            }

            return NextResponse.json({ ok: true, recipe: mapToRecipeInfo(recipe) });
        }

        // List all recipes for the authenticated user
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const userId = p.sub;

        const recipes = await prisma.customRecipe.findMany({
            where: { userId },
        });

        return NextResponse.json({
            ok: true,
            recipes: recipes.map((r) => ({
                id: r.id,
                userId: r.userId,
                title: r.title,
                servings: r.servings,
                readyInMinutes: r.readyInMinutes,
                dishTypes: r.dishTypes,
                cuisines: r.cuisines,
                ingredients: r.ingredients,
                instructions: r.instructions,
                createdAt: r.createdAt.toISOString(),
                image: r.image ?? undefined,
            })),
            count: recipes.length,
        });
    } catch (error) {
        if (error instanceof Error && error.message === "no token") {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error in GET /api/recipes/create:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
