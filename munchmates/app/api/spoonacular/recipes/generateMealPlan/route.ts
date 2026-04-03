// app/api/spoonacular/recipes/generateMealPlan/route.ts
// Proxy endpoint for Spoonacular meal plan generation
// Accepts timeFrame, targetCalories, diet, and exclude params

import { NextRequest, NextResponse } from 'next/server';
import { handleRouteError, errorResponse } from '@/lib/apiErrors';
import { generateMealPlan } from '@/lib/spoonacular';
import { rateLimiter } from '@/lib/rateLimiter';

export async function GET(req: NextRequest) {
  // Rate limiting by IP address
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
  const { success } = await rateLimiter.limit(ip);
  if (!success) {
      return errorResponse(429, "Too Many Requests");
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
