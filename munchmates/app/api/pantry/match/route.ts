// POST /api/pantry/match
// Matches recipe ingredients against user's pantry items
// Returns match status (matched/partial/unmatched) for each ingredient

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";
import { matchPantryIngredients, PantryIngredientInput } from "@/lib/pantry-service";

export async function POST(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const body = await req.json();

        if (!body.ingredients || !Array.isArray(body.ingredients)) {
            return errorResponse(400, "Missing required field: ingredients (array)");
        }

        const ingredients: PantryIngredientInput[] = body.ingredients;

        // Fetch all pantry items for user
        const pantryItems = await prisma.pantryItem.findMany({
            where: { userId: p.sub },
        });

        const matches = matchPantryIngredients(pantryItems, ingredients);

        return NextResponse.json({ ok: true, matches });
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/pantry/match:");
    }
}
