// POST /api/pantry/match
// Matches recipe ingredients against user's pantry items
// Returns match status (matched/partial/unmatched) for each ingredient

import { type NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { matchPantryIngredients, type PantryIngredientInput } from "@/lib/pantry-service";
import { prisma } from "@/lib/prisma";
import { verifyBearer } from "@/lib/verifyToken";

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
