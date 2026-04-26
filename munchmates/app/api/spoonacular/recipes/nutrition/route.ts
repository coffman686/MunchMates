//file: api/recipes/nutrition/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, handleRouteError } from '@/lib/apiErrors';
import { getRecipeNutrition } from '@/lib/spoonacular';
import { verifyBearer } from '@/lib/verifyToken';

export async function GET(request: NextRequest) {
  // Verify bearer token for authentication
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  try {
    await verifyBearer(authHeader ?? undefined);
  } catch (err) {
    return errorResponse(401, "Unauthorized");
  }
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
