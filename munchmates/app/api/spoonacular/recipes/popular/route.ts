// app/api/spoonacular/recipes/popular/route.ts
// Proxy endpoint to fetch popular recipes from Spoonacular
// Used by the dashboard carousel for trending recipe suggestions

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, handleRouteError } from '@/lib/apiErrors';
import { searchRecipes } from '@/lib/spoonacular';
import { verifyBearer } from '@/lib/verifyToken';

export async function GET(req: NextRequest) {
  // Verify bearer token for authentication
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  try {
    await verifyBearer(authHeader ?? undefined);
  } catch (err) {
    return errorResponse(401, "Unauthorized");
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
