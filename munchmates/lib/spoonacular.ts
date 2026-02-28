// lib/spoonacular.ts
// Provides typed wrappers around Spoonacular endpoints for
// recipes, ingredients, nutrition, meal planning, and image URL
// helpers, along with a shared fetch handler that injects the API key.
import { getOrSetJsonSWR, stableKey } from './cache';
const SPOONACULAR_API_BASE_URL = 'https://api.spoonacular.com';

function ttlFor(endpoint: string): number | null {
  // return null = do not cache
  if (endpoint.startsWith('/recipes/complexSearch')) return 60 * 30; //30 min
  if (endpoint.startsWith('/recipes/findByIngredients')) return 60 * 30; //30 min (typical recipe search can fallback here)
  if (endpoint.includes('/information')) return 60 * 60 * 24 * 7;    //7 days
  if (endpoint.includes('/nutritionWidget.json')) return 60 * 60 * 24 * 7; //7 days
  if (endpoint.startsWith('/food/ingredients/search')) return 60 * 60 * 24 * 30; //30 days
  if (endpoint.includes('/food/ingredients/') && endpoint.includes('/information')) return 60 * 60 * 24 * 30; //30 days
  if (endpoint.includes('/similar')) return 60 * 60 * 24; //1 day
  if (endpoint.includes('/analyzedInstructions')) return 60 * 60 * 24 * 7; //7 days
  if (endpoint.startsWith('/mealplanner/generate')) return 60 * 10; //10 min (if you cache)
  if (endpoint.startsWith('/recipes/random')) return null; //random should be random
  return 60 * 60; //fallback 1 hour
}

function swrWindowsFor(endpoint: string): { freshFor: number; staleFor: number } | null {
  const ttl = ttlFor(endpoint);
  if (ttl === null) return null;

  //Short TTLs: allow 2x stale window (smooths out expiry cliffs)
  if (ttl <= 60 * 60) {
    return { freshFor: ttl, staleFor: ttl * 2 };
  }

  //Medium TTLs (e.g., 1 day): allow +1 day stale
  if (ttl <= 60 * 60 * 24) {
    return { freshFor: ttl, staleFor: ttl + 60 * 60 * 24 };
  }

  //Long TTLs (7d, 30d): allow +1 day stale (cap staleness)
  return { freshFor: ttl, staleFor: ttl + 60 * 60 * 24 };
}

function getApiKey(): string {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    throw new Error('SPOONACULAR_API_KEY is not set in environment variables');
  }
  return apiKey;
}

// base fetch function
async function spoonacularFetch<T>(
  endpoint: string,
  params: Record<string, string | number | boolean> = {}
): Promise<T> {
  const apiKey = getApiKey();
  const ttl = ttlFor(endpoint);
  const fetcher = async (): Promise<T> => {
    const urlParams = new URLSearchParams({
      ...params,
      apiKey,
    } as Record<string, string>);

    const url = `${SPOONACULAR_API_BASE_URL}${endpoint}?${urlParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
          `Spoonacular API error (${response.status}): ${errorText}`
      );
    }

    return response.json();
  };
  if (ttl === null) {
    return fetcher();
  }

  const swr = swrWindowsFor(endpoint); //Check to see the fresh and stale vals
  if (!swr) return fetcher();

  const cacheKey = stableKey('spoonacular', endpoint, params);
  return getOrSetJsonSWR<T>(cacheKey, swr.freshFor, swr.staleFor, fetcher);
}


// type definitions //

export interface Recipe {
  id: number;
  title: string;
  image?: string;
  imageType?: string;
  readyInMinutes?: number;
  servings?: number;
  sourceUrl?: string;
  spoonacularSourceUrl?: string;
  spoonacularScore?: number;
  cuisines?: string[];
  dishTypes?: string[];
}

export interface RecipeInformation extends Recipe {
  cheap: boolean;
  creditsText: string;
  cuisines: string[];
  dairyFree: boolean;
  diets: string[];
  dishTypes: string[];
  gaps: string;
  glutenFree: boolean;
  healthScore: number;
  instructions: string;
  ketogenic: boolean;
  lowFodmap: boolean;
  occasions: string[];
  sustainable: boolean;
  vegan: boolean;
  vegetarian: boolean;
  veryHealthy: boolean;
  veryPopular: boolean;
  whole30: boolean;
  weightWatcherSmartPoints: number;
  extendedIngredients: ExtendedIngredient[];
  summary: string;
}

export interface ExtendedIngredient {
  id: number;
  aisle: string;
  image: string;
  name: string;
  amount: number;
  unit: string;
  unitShort: string;
  unitLong: string;
  originalString: string;
  metaInformation: string[];
}

export interface WineProduct {
  id: number;
  title: string;
  description: string;
  price: string;
  imageUrl: string;
  averageRating: number;
  ratingCount: number;
  score: number;
  link: string;
}

export interface SearchRecipesResult {
  results: Recipe[];
  offset: number;
  number: number;
  totalResults: number;
}

export interface Ingredient {
  id: number;
  name: string;
  image: string;
  amount?: number;
  unit?: string;
}

export interface IngredientSearchResult {
  results: Ingredient[];
  offset: number;
  number: number;
  totalResults: number;
}

export interface NutritionInfo {
  calories: string;
  carbs: string;
  fat: string;
  protein: string;
}

// recipe endpoints //


//search for recipes by query
//@param query - search query (e.g., "pasta", "chicken")
//@param options - additional search parameters

export async function searchRecipes(
  query: string,
  options: {
    cuisine?: string;
    diet?: string; // e.g., "vegetarian", "vegan", "gluten free"
    intolerances?: string; // e.g., "dairy", "egg", "gluten"
    number?: number; // Number of results (default: 10, max: 100)
    offset?: number; // Offset for pagination
    addRecipeInformation?: boolean;
    type?: string;
    includeIngredients?: string; // Comma-separated list of ingredients to include
  } = {}
): Promise<SearchRecipesResult> {
  return spoonacularFetch<SearchRecipesResult>('/recipes/complexSearch', {
    query,
    ...options,
  });
}
// get recipe instructions
// @param recipeId - the Spoonacular recipe ID
export async function getRecipeInstructions(
  recipeId: number
): Promise<any> {
  return spoonacularFetch<any>(
    `/recipes/${recipeId}/analyzedInstructions`,
    {}
  );
}

// get detailed information about a specific recipe
// @param recipeId - the Spoonacular recipe ID

export async function getRecipeInformation(
  recipeId: number
): Promise<RecipeInformation> {
  return spoonacularFetch<RecipeInformation>(
    `/recipes/${recipeId}/information`,
    {}
  );
}


// get random recipes
// @param options - filter options

export async function getRandomRecipes(options: {
  number?: number; // Number of recipes (default: 1, max: 100)
  tags?: string; // Comma-separated tags (e.g., "vegetarian,dessert")
} = {}): Promise<{ recipes: RecipeInformation[] }> {
  return spoonacularFetch<{ recipes: RecipeInformation[] }>(
    '/recipes/random',
    options
  );
}


 // search recipes by ingredients
 // @param ingredients - comma-separated list of ingredients (e.g., "apples,flour,sugar")
 // @param options - additional options

export async function searchRecipesByIngredients(
  ingredients: string,
  options: {
    number?: number;
    ranking?: 1 | 2; // 1 = maximize used ingredients, 2 = minimize missing ingredients
    ignorePantry?: boolean;
  } = {}
): Promise<Recipe[]> {
  return spoonacularFetch<Recipe[]>('/recipes/findByIngredients', {
    ingredients,
    ...options,
  });
}


// Get similar recipes to a given recipe
// @param recipeId - The Spoonacular recipe ID
// @param number - Number of similar recipes to return (default: 10)

export async function getSimilarRecipes(
  recipeId: number,
  number: number = 10
): Promise<Recipe[]> {
  return spoonacularFetch<Recipe[]>(`/recipes/${recipeId}/similar`, {
    number,
  });
}

// ingredient endpoints //

// search for ingredients
// @param query - search query
// @param options - additional options

export async function searchIngredients(
  query: string,
  options: {
    number?: number;
    metaInformation?: boolean;
    intolerances?: string;
  } = {}
): Promise<IngredientSearchResult> {
  return spoonacularFetch<IngredientSearchResult>(
    '/food/ingredients/search',
    {
      query,
      ...options,
    }
  );
}

// get information about a specific ingredient
// @param ingredientId - the Spoonacular ingredient ID
// @param amount - amount of the ingredient
// @param unit - unit of measurement

export async function getIngredientInformation(
  ingredientId: number,
  amount: number = 1,
  unit: string = 'serving'
): Promise<Ingredient> {
  return spoonacularFetch<Ingredient>(
    `/food/ingredients/${ingredientId}/information`,
    { amount, unit }
  );
}

// meal planning endpoints //

// generate a meal plan for a specific timeframe
//@param options - meal plan parameters

export async function generateMealPlan(options: {
  timeFrame?: 'day' | 'week';
  targetCalories?: number;
  diet?: string;
  exclude?: string;
} = {}): Promise<any> {
  return spoonacularFetch<any>('/mealplanner/generate', {
    timeFrame: 'day',
    ...options,
  });
}

// nutrition endpoints //

//get nutrition information for a recipe
//@param recipeId - the Spoonacular recipe ID

export async function getRecipeNutrition(
  recipeId: number
): Promise<NutritionInfo> {
  return spoonacularFetch<NutritionInfo>(
    `/recipes/${recipeId}/nutritionWidget.json`,
    {}
  );
}

// utility funcs //

// get the full image URL for a recipe
// @param filename - the image filename from Spoonacular
// @param size - image size (90x90, 240x150, 312x150, 312x231, 480x360, 556x370, 636x393)

export function getRecipeImageUrl(
  filename: string,
  size: '90x90' | '240x150' | '312x231' | '480x360' | '556x370' | '636x393' = '312x231'
): string {
  return `https://spoonacular.com/recipeImages/${filename}`;
}

// Get the full image URL for an ingredient
// @param filename - The image filename from Spoonacular
// @param size - Image size (100x100 or 250x250)

export function getIngredientImageUrl(
  filename: string,
  size: '100x100' | '250x250' = '100x100'
): string {
  return `https://spoonacular.com/cdn/ingredients_${size}/${filename}`;
}

export default {
  searchRecipes,
  getRecipeInformation,
  getRandomRecipes,
  searchRecipesByIngredients,
  getSimilarRecipes,
  searchIngredients,
  getIngredientInformation,
  generateMealPlan,
  getRecipeNutrition,
  getRecipeImageUrl,
  getIngredientImageUrl,
};
