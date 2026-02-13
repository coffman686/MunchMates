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

export async function GET(req: NextRequest) {
  const recipeId = req.nextUrl.searchParams.get('id');

  if (!recipeId) {
    return errorResponse(400, 'Recipe ID is required');
  }

  try {
    const recipeInfo = await getRecipeInformation(parseInt(recipeId, 10));
    return NextResponse.json(recipeInfo);
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch recipe info');
  }
}
