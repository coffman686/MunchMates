// api/recipes/searchByIngredient/route.ts
// Endpoint for searching recipes by ingredients or text query
// Inputs:
// - ingredients: CS list of ingredients the recipe should contain
// - query: text search query for recipe name/keyword
// - cuisine: the cuisine the recipe should be a part of
// - dishType: the type of recipe to look for
// - diets: the user's diet
// - intolerances: the user's intolerances and allergens

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { searchRecipes } from '@/lib/spoonacular';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const ingredients = searchParams.get('ingredients') ?? undefined;
    const query = searchParams.get('query') ?? undefined;
    const cuisine = searchParams.get('cuisine') ?? undefined
    const dishType = searchParams.get('dishType') ?? undefined
    const diet = searchParams.get("diet") ?? undefined;
    const intolerances = searchParams.get("intolerances") ?? undefined;
    if (!ingredients && !query) {
        return errorResponse(400, 'Missing ingredients or query parameter');
    }
    try {
        const recipes = await searchRecipes(query ?? '', {
            includeIngredients: ingredients,
            addRecipeInformation: true,
            cuisine: cuisine,
            type: dishType,
            diet: diet,
            intolerances: intolerances,
            number: 100,
            sort: query ? '' : (ingredients ? 'max-used-ingredients' : 'popularity'),
            fillIngredients: true,
        });
        const results = recipes.results.map((recipe) => ({
            id: recipe.id,
            title: recipe.title,
            image: recipe.image,
            score: recipe.spoonacularScore ? Math.round(recipe.spoonacularScore) : 0,
            servings: recipe.servings,
            readyInMinutes: recipe.readyInMinutes,
            cuisines: recipe.cuisines,
            dishTypes: recipe.dishTypes,
            usedIngredients: (recipe.usedIngredients || []).map((i: any) => i.name),
            missedIngredientCount: (recipe.missedIngredients || []).length,
        }));
        // Sort by most used ingredients first, then by popularity score as tiebreaker
        results.sort((a, b) =>
            b.usedIngredients.length - a.usedIngredients.length
            || b.score - a.score
        );
        return NextResponse.json({ results });
    } catch (error) {
        return handleRouteError(error, 'Failed to fetch recipes by ingredient');
    }
}
