// file: ingredient-aggregator.ts
// Aggregates ingredients from weekly meal plans together cohesively
// - Fetches recipe ingredient information via spoonacular API
// - Standardizes ingredient units across the same items
// - Pools together items by type and category
// - Produces human readable final output with reasonable units

import { WeeklyMealPlan, MealPlanEntry, AggregatedIngredient } from './types/meal-plan';
import { consolidateIngredients } from './grocery-consolidation';

// ExtendedIngredient type (copied from spoonacular.ts to avoid importing server-side code)
interface ExtendedIngredient {
  id: number;
  aisle?: string;
  image?: string;
  name: string;
  amount: number;
  unit: string;
  unitShort?: string;
  unitLong?: string;
  original?: string;
  originalString?: string;
  metaInformation?: string[];
}

interface RecipeInfo {
  title: string;
  extendedIngredients: ExtendedIngredient[];
}

type IngredientCategory =
  | 'Produce'
  | 'Dairy'
  | 'Meat & Seafood'
  | 'Bakery'
  | 'Frozen'
  | 'Spices & Seasonings'
  | 'Canned Goods'
  | 'Pasta & Grains'
  | 'Condiments'
  | 'Oils & Vinegars'
  | 'Baking'
  | 'Beverages'
  | 'Pantry'
  | 'Other';

function normalizeRecipeInfo(payload: unknown, isCustom: boolean): RecipeInfo | null {
  if (!payload || typeof payload !== 'object') return null;

  const recipe = isCustom
    ? (payload as { recipe?: { title?: string; extendedIngredients?: ExtendedIngredient[] } }).recipe
    : (payload as { title?: string; extendedIngredients?: ExtendedIngredient[] });

  if (!recipe) return null;

  const title = typeof recipe.title === 'string' ? recipe.title : 'Custom Recipe';
  const rawIngredients = Array.isArray(recipe.extendedIngredients) ? recipe.extendedIngredients : [];

  return {
    title,
    extendedIngredients: rawIngredients.map((ingredient, index) => ({
      id: typeof ingredient.id === 'number' ? ingredient.id : index,
      aisle: ingredient.aisle || '',
      image: ingredient.image || '',
      name: ingredient.name || ingredient.original || ingredient.originalString || '',
      amount: Number(ingredient.amount) || 0,
      unit: ingredient.unit || '',
      unitShort: ingredient.unitShort || ingredient.unit || '',
      unitLong: ingredient.unitLong || ingredient.unit || '',
      original: ingredient.original || ingredient.originalString || ingredient.name || '',
      originalString: ingredient.originalString || ingredient.original || ingredient.name || '',
      metaInformation: ingredient.metaInformation || [],
    })),
  };
}

// --- Ingredient filtering constants ---

// Solution 1: Common staples most people always have at home
const EXCLUDED_STAPLES: Set<string> = new Set([
  'salt',
  'pepper',
  'black pepper',
  'water',
  'ice',
  'cooking spray',
  'nonstick cooking spray',
  'non-stick cooking spray',
]);

// Solution 2: Map variant names to canonical names for deduplication
const INGREDIENT_ALIASES: Record<string, string> = {
  'sea salt': 'salt',
  'kosher salt': 'salt',
  'table salt': 'salt',
  'coarse salt': 'salt',
  'fine salt': 'salt',
  'flaky salt': 'salt',
  'pinch salt': 'salt',
  'salt or': 'salt',
  'freshly cracked pepper': 'black pepper',
  'ground pepper': 'black pepper',
  'freshly ground pepper': 'black pepper',
  'cracked pepper': 'black pepper',
  'freshly ground black pepper': 'black pepper',
  'ground black pepper': 'black pepper',
};

// Compound entries where both components are staples — skip entirely
const EXCLUDED_COMPOUNDS: Set<string> = new Set([
  'salt and pepper',
  'salt & pepper',
  'salt and pepper to taste',
  'salt & pepper to taste',
]);

// Solution 4: Patterns indicating non-quantified / trivial ingredients
const TO_TASTE_PATTERNS: RegExp[] = [
  /\bto taste\b/i,
  /\bas needed\b/i,
  /\bfor garnish\b/i,
  /\bfor serving\b/i,
];

function isToTaste(originalString: string): boolean {
  if (!originalString) return false;
  return TO_TASTE_PATTERNS.some((pattern) => pattern.test(originalString));
}

// Fetch recipe information via API route (client-safe)
async function fetchRecipeInfo(recipeId: number): Promise<RecipeInfo | null> {
  try {
    const customResponse = await fetch(`/api/recipes/create?id=${recipeId}`);
    if (customResponse.ok) {
      const payload = await customResponse.json();
      return normalizeRecipeInfo(payload, true);
    }

    const spoonacularResponse = await fetch(`/api/spoonacular/recipes/information?id=${recipeId}`);
    if (!spoonacularResponse.ok) {
      console.error(`Failed to fetch recipe ${recipeId}: ${spoonacularResponse.status}`);
      return null;
    }
    const payload = await spoonacularResponse.json();
    return normalizeRecipeInfo(payload, false);
  } catch (error) {
    console.error(`Error fetching recipe ${recipeId}:`, error);
    return null;
  }
}

// Map aisle to a simpler category
export function mapAisleToCategory(aisle: string): IngredientCategory {
  const lowerAisle = aisle.toLowerCase();

  if (lowerAisle.includes('produce') || lowerAisle.includes('vegetable') || lowerAisle.includes('fruit')) {
    return 'Produce';
  }
  if (lowerAisle.includes('dairy') || lowerAisle.includes('milk') || lowerAisle.includes('cheese') || lowerAisle.includes('egg')) {
    return 'Dairy';
  }
  if (lowerAisle.includes('meat') || lowerAisle.includes('seafood') || lowerAisle.includes('poultry')) {
    return 'Meat & Seafood';
  }
  if (lowerAisle.includes('bakery') || lowerAisle.includes('bread')) {
    return 'Bakery';
  }
  if (lowerAisle.includes('frozen')) {
    return 'Frozen';
  }
  if (lowerAisle.includes('spice') || lowerAisle.includes('seasoning')) {
    return 'Spices & Seasonings';
  }
  if (lowerAisle.includes('canned') || lowerAisle.includes('jarred')) {
    return 'Canned Goods';
  }
  if (lowerAisle.includes('pasta') || lowerAisle.includes('rice') || lowerAisle.includes('grain')) {
    return 'Pasta & Grains';
  }
  if (lowerAisle.includes('condiment') || lowerAisle.includes('sauce')) {
    return 'Condiments';
  }
  if (lowerAisle.includes('oil') || lowerAisle.includes('vinegar')) {
    return 'Oils & Vinegars';
  }
  if (lowerAisle.includes('baking')) {
    return 'Baking';
  }
  if (lowerAisle.includes('beverage') || lowerAisle.includes('drink')) {
    return 'Beverages';
  }

  return 'Other';
}

const CATEGORY_PATTERNS: Array<{ category: IngredientCategory; patterns: RegExp[] }> = [
  {
    category: 'Produce',
    patterns: [
      /\b(apple|banana|orange|lemon|lime|grapefruit|strawberry|blueberry|raspberry|blackberry|grape|watermelon|cantaloupe|honeydew|pineapple|mango|peach|nectarine|plum|pear|kiwi|pomegranate|cherry|apricot|cranberry|fig|date)\b/,
      /\b(broccoli|cauliflower|carrot|celery|cucumber|zucchini|squash|pumpkin|sweet potato|potato|onion|shallot|garlic|ginger|pepper|jalapeno|jalapeño|serrano|habanero|poblano|tomato|spinach|kale|lettuce|greens|arugula|cabbage|brussels sprouts|asparagus|green beans|peas|mushroom|eggplant|beet|radish|leek|fennel|corn|avocado)\b/,
      /\b(basil|cilantro|parsley|mint|rosemary|thyme|oregano|dill|chives|sage|tarragon)\b/,
    ],
  },
  {
    category: 'Dairy',
    patterns: [
      /\b(milk|buttermilk|cream|half and half|yogurt|butter|ghee|cheese|mozzarella|cheddar|parmesan|feta|goat cheese|swiss|provolone|monterey jack|pepper jack|blue cheese|cream cheese|cottage cheese|sour cream|egg|eggs|egg white|egg yolk)\b/,
    ],
  },
  {
    category: 'Meat & Seafood',
    patterns: [
      /\b(chicken|turkey|pork|bacon|sausage|beef|steak|lamb|ham|salmon|tilapia|cod|shrimp|scallops|tuna|sardines|crab|lobster|fish|anchovy|anchovies)\b/,
    ],
  },
  {
    category: 'Bakery',
    patterns: [
      /\b(bread|bagel|bun|buns|pita|naan|roll|rolls|croissant|muffin|tortilla|wrap)\b/,
    ],
  },
  {
    category: 'Frozen',
    patterns: [
      /\bfrozen\b/,
      /\bice cream\b/,
    ],
  },
  {
    category: 'Spices & Seasonings',
    patterns: [
      /\b(salt|pepper|paprika|cayenne|chili powder|cumin|coriander|turmeric|curry powder|garlic powder|onion powder|italian seasoning|herbes de provence|seasoning|spice blend)\b/,
    ],
  },
  {
    category: 'Canned Goods',
    patterns: [
      /\b(canned|can of|jarred|diced tomatoes|tomato paste|tomato sauce|crushed tomatoes|black beans|pinto beans|kidney beans|chickpeas|lentils|broth|stock)\b/,
    ],
  },
  {
    category: 'Pasta & Grains',
    patterns: [
      /\b(rice|quinoa|couscous|bulgur|farro|barley|oats|oatmeal|bread crumbs|spaghetti|penne|macaroni|fettuccine|lasagna noodles|egg noodles|ramen|rice noodles|udon|pasta|noodles)\b/,
    ],
  },
  {
    category: 'Condiments',
    patterns: [
      /\b(soy sauce|tamari|fish sauce|oyster sauce|worcestershire|hot sauce|sriracha|ketchup|mustard|mayonnaise|bbq sauce|ranch|dressing|vinaigrette|marinara|salsa|peanut butter|almond butter|jam|jelly|pickle|pickles|olives)\b/,
    ],
  },
  {
    category: 'Oils & Vinegars',
    patterns: [
      /\b(olive oil|vegetable oil|canola oil|avocado oil|sesame oil|coconut oil|balsamic vinegar|red wine vinegar|white wine vinegar|rice vinegar|apple cider vinegar|vinegar)\b/,
    ],
  },
  {
    category: 'Baking',
    patterns: [
      /\b(flour|cornmeal|baking powder|baking soda|yeast|sugar|brown sugar|powdered sugar|honey|maple syrup|agave|vanilla extract|cocoa powder|chocolate chips|cornstarch)\b/,
    ],
  },
  {
    category: 'Beverages',
    patterns: [
      /\b(juice|soda|sparkling water|coffee|tea|wine|beer)\b/,
    ],
  },
  {
    category: 'Pantry',
    patterns: [
      /\b(tofu|tempeh|seitan|beans|lentils|nuts|walnuts|pecans|almonds|cashews|peanuts|seeds)\b/,
    ],
  },
];

export function inferIngredientCategory(ingredient: Pick<ExtendedIngredient, 'name' | 'original' | 'originalString'>): IngredientCategory {
  const haystack = [ingredient.name, ingredient.original, ingredient.originalString]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();

  if (!haystack) {
    return 'Other';
  }

  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(haystack))) {
      return category;
    }
  }

  return 'Other';
}

export function resolveIngredientCategory(ingredient: ExtendedIngredient): IngredientCategory {
  const aisle = ingredient.aisle?.trim();
  if (aisle) {
    return mapAisleToCategory(aisle);
  }

  return inferIngredientCategory(ingredient);
}

export async function aggregateIngredients(weekPlan: WeeklyMealPlan): Promise<AggregatedIngredient[]> {
  // Collect all recipe IDs from the week plan
  const recipeEntries: MealPlanEntry[] = [];

  for (const day of weekPlan.days) {
    if (day.breakfast) recipeEntries.push(day.breakfast);
    if (day.lunch) recipeEntries.push(day.lunch);
    if (day.dinner) recipeEntries.push(day.dinner);
  }

  if (recipeEntries.length === 0) {
    return [];
  }

  // Fetch full recipe information for each recipe via API route
  // Batch in groups of 4 to stay under Spoonacular's 5 req/sec limit
  const uniqueRecipeIds = [...new Set(recipeEntries.map((e) => e.recipeId))];
  const recipeInfoMap = new Map<number, { ingredients: ExtendedIngredient[]; title: string }>();

  const BATCH_SIZE = 4;
  for (let i = 0; i < uniqueRecipeIds.length; i += BATCH_SIZE) {
    const batch = uniqueRecipeIds.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (recipeId) => {
        const info = await fetchRecipeInfo(recipeId);
        if (info) {
          recipeInfoMap.set(recipeId, {
            ingredients: info.extendedIngredients || [],
            title: info.title,
          });
        }
      })
    );
    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < uniqueRecipeIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  const collectedIngredients: Array<{
    name: string;
    amount: number;
    unit: string;
    category: string;
    sourceRecipe: string;
  }> = [];

  for (const entry of recipeEntries) {
    const recipeInfo = recipeInfoMap.get(entry.recipeId);
    if (!recipeInfo) continue;

    // Calculate serving multiplier based on user's desired servings vs recipe's original servings
    // entry.servings = user's desired servings for this meal
    // entry.originalServings = recipe's default servings (from Spoonacular)
    const originalServings = entry.originalServings || 1;
    const desiredServings = entry.servings || originalServings;
    const servingMultiplier = desiredServings / originalServings;

    for (const ingredient of recipeInfo.ingredients) {
      let key = ingredient.name.toLowerCase().trim();

      // Solution 2: Skip compound staple entries (e.g. "salt and pepper")
      if (EXCLUDED_COMPOUNDS.has(key)) continue;

      // Solution 2: Resolve variant names to canonical names
      if (INGREDIENT_ALIASES[key]) {
        key = INGREDIENT_ALIASES[key];
      }

      // Solution 1: Skip common staples
      if (EXCLUDED_STAPLES.has(key)) continue;

      // Solution 4: Skip "to taste" / non-quantified ingredients
      if (isToTaste(ingredient.originalString || ingredient.original || '')) continue;

      const adjustedAmount = (ingredient.amount || 0) * servingMultiplier;
      const unit = ingredient.unit || ingredient.unitShort || ingredient.unitLong || '';
      const category = resolveIngredientCategory(ingredient);
      const displayName = INGREDIENT_ALIASES[ingredient.name.toLowerCase().trim()]
        ? key
        : ingredient.name;

      collectedIngredients.push({
        name: displayName,
        amount: adjustedAmount,
        unit,
        category,
        sourceRecipe: entry.title,
      });
    }
  }
  return consolidateIngredients(collectedIngredients);
}
