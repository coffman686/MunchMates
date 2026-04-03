// app/api/spoonacular/recipes/popular/route.ts
// Proxy endpoint to fetch popular recipes from Spoonacular
// Used by the dashboard carousel for trending recipe suggestions

import { NextRequest, NextResponse } from 'next/server';
import { handleRouteError, errorResponse } from '@/lib/apiErrors';
import { searchRecipes } from '@/lib/spoonacular';
import { rateLimiter } from '@/lib/rateLimiter';

export async function GET(req: NextRequest) {
  // Rate limiting by IP address
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
  const { success } = await rateLimiter.limit(ip);
  if (!success) {
      return errorResponse(429, "Too Many Requests");
  }
  const offsetParam = req.nextUrl.searchParams.get('offset');
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

  try {
    const results = await searchRecipes('', {
      sort: 'popularity',
      number: 4,
      offset,
      addRecipeInformation: true,
    });

    return NextResponse.json({ recipes: results.results });
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch popular recipes');
  }
}
