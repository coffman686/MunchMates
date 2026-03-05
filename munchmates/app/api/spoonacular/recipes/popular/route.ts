// app/api/spoonacular/recipes/popular/route.ts
// Proxy endpoint to fetch popular recipes from Spoonacular
// Used by the dashboard carousel for trending recipe suggestions

import { NextRequest, NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/apiErrors';
import { searchRecipes } from '@/lib/spoonacular';

export async function GET(req: NextRequest) {
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
