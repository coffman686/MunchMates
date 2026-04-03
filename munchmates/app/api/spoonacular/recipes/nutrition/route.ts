import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, handleRouteError } from '@/lib/apiErrors';
import { getRecipeNutrition } from '@/lib/spoonacular';
import { rateLimiter } from '@/lib/rateLimiter';

export async function GET(request: NextRequest) {
  // Rate limiting by IP address
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "anonymous";
  const { success } = await rateLimiter.limit(ip);
  if (!success) {
      return errorResponse(429, "Too Many Requests");
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
