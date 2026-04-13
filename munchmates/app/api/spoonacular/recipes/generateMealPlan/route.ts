// app/api/spoonacular/recipes/generateMealPlan/route.ts
// Proxy endpoint for Spoonacular meal plan generation
// Accepts timeFrame, targetCalories, diet, and exclude params

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, handleRouteError } from '@/lib/apiErrors';
import { generateMealPlan } from '@/lib/spoonacular';
import { verifyBearer } from '@/lib/verifyToken';

export async function GET(req: NextRequest) {
  // Verify bearer token for authentication
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    try {
      await verifyBearer(authHeader ?? undefined);
    } catch (err) {
      return errorResponse(401, "Unauthorized");
    }
  const params = req.nextUrl.searchParams;
  const timeFrame = (params.get('timeFrame') as 'day' | 'week') || 'week';
  const targetCalories = params.get('targetCalories');
  const diet = params.get('diet');
  const exclude = params.get('exclude');

  try {
    const options: Record<string, string | number> = { timeFrame };
    if (targetCalories) options.targetCalories = parseInt(targetCalories, 10);
    if (diet) options.diet = diet;
    if (exclude) options.exclude = exclude;

    const data = await generateMealPlan(options);
    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'Failed to generate meal plan');
  }
}
