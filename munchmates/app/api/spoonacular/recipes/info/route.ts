// recipes/info/route.ts
// GET endpoint to fetch full recipe information from Spoonacular.
// Query params:
//   id (required)         — Spoonacular recipe ID
//   normalize (optional)  — when "true", normalizes extendedIngredients[].name
//                           for pantry/canonName matching. Original is preserved
//                           as `originalName`. Defaults to false.

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { getRecipeInformation } from '@/lib/spoonacular';
import { normalize } from '@/lib/normalize';

export async function GET(req: NextRequest) {
  const recipeId = req.nextUrl.searchParams.get('id');
  const shouldNormalize = req.nextUrl.searchParams.get('normalize') === 'true';

  if (!recipeId) {
    return errorResponse(400, 'Recipe ID is required');
  }

  try {
    const recipeInfo = await getRecipeInformation(parseInt(recipeId, 10));

    if (shouldNormalize && recipeInfo.extendedIngredients) {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('402')) {
      return errorResponse(402, 'API daily limit reached. Please try again tomorrow or upgrade your Spoonacular plan.');
    }
    return handleRouteError(error, 'Failed to fetch recipe info');
  }
}
