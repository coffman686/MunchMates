// app/api/spoonacular/recipes/autocomplete/route.ts
// Proxy endpoint for Spoonacular recipe autocomplete suggestions
// Returns matching recipe titles and IDs for typeahead search

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, handleRouteError } from '@/lib/apiErrors';
import { autocompleteRecipes } from '@/lib/spoonacular';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query');
  const numberParam = req.nextUrl.searchParams.get('number');
  const number = numberParam ? parseInt(numberParam, 10) : 7;

  if (!query) {
    return errorResponse(400, 'Missing query parameter');
  }

  try {
    const suggestions = await autocompleteRecipes(query, number);
    return NextResponse.json({ suggestions });
  } catch (error) {
    return handleRouteError(error, 'Failed to autocomplete recipes');
  }
}
