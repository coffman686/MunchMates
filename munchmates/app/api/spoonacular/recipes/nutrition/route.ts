//file: api/recipes/nutrition/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, handleRouteError } from '@/lib/apiErrors';
import { getRecipeNutrition } from '@/lib/spoonacular';

export async function GET(request: NextRequest) {
  const recipeIdParam = request.nextUrl.searchParams.get('id');

  if (!recipeIdParam) {
    return errorResponse(400, 'Missing id parameter');
  }

  const recipeId = parseInt(recipeIdParam, 10);
  if (Number.isNaN(recipeId)) {
    return errorResponse(400, 'Invalid recipe ID');
  }

  try {
    const nutritionData = await getRecipeNutrition(recipeId);
    return NextResponse.json(nutritionData);
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch recipe nutrition');
  }
}
