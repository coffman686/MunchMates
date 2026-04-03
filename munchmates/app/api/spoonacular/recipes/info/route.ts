// file: recipes/info/route.ts
// GET endpoint to fetch additioinal recipe information
// Inputs: spooncular recipe ID
// Output:
// - Recipe information if successful
// - 404 if id not provided
// - 500 otherwise

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { getRecipeInformation } from '@/lib/spoonacular';
import { normalize } from '@/lib/normalize';
import { rateLimiter } from '@/lib/rateLimiter';

export async function GET(req: NextRequest) {
  // Rate limiting by IP address
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
  const { success } = await rateLimiter.limit(ip);
  if (!success) {
      return errorResponse(429, "Too Many Requests");
  }
  const recipeId = req.nextUrl.searchParams.get('id');

  if (!recipeId) {
    return errorResponse(400, 'Recipe ID is required');
  }

  try {
    const recipeInfo = await getRecipeInformation(parseInt(recipeId, 10));

    // Normalize ingredient names for matching with pantry canonName values.
    // Preserve the original name for display purposes.
    if (recipeInfo.extendedIngredients) {
      recipeInfo.extendedIngredients = recipeInfo.extendedIngredients.map(
        (ingredient) => ({
          ...ingredient,
          originalName: ingredient.name,
          name: normalize(ingredient.name),
        })
      );
    }

    return NextResponse.json(recipeInfo);
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch recipe info');
  }
}
