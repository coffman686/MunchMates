// file: ingredient-aggregator.ts
// Aggregates ingredients from weekly meal plans together cohesively
// - Fetches recipe ingredient information via spoonacular API
// - Standardizes ingredient units across the same items
// - Pools together items by type and category
// - Produces human readable final output with reasonable units

import { WeeklyMealPlan, MealPlanEntry, AggregatedIngredient } from './types/meal-plan';
import {
  getUnitType,
  convertToBase,
  convertFromBase,
  formatAmount,
  COUNT_MULTIPLIERS,
  normalizeUnit,
} from './unit-conversion';

// ExtendedIngredient type (copied from spoonacular.ts to avoid importing server-side code)
interface ExtendedIngredient {
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

interface RecipeInfo {
  title: string;
  extendedIngredients: ExtendedIngredient[];
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
    const response = await fetch(`/api/spoonacular/recipes/info?id=${recipeId}`);
    if (!response.ok) {
      console.error(`Failed to fetch recipe ${recipeId}: ${response.status}`);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error(`Error fetching recipe ${recipeId}:`, error);
    return null;
  }
}

// Map aisle to a simpler category
function mapAisleToCategory(aisle: string): string {
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

  return 'Pantry';
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

  // Aggregate ingredients
  const aggregated = new Map<string, {
    name: string;
    amounts: { amount: number; unit: string; unitType: string }[];
    category: string;
    sourceRecipes: Set<string>;
  }>();

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
      if (isToTaste(ingredient.originalString)) continue;

      const adjustedAmount = (ingredient.amount || 0) * servingMultiplier;
      const unit = ingredient.unit || '';
      const unitType = getUnitType(unit);
      const category = mapAisleToCategory(ingredient.aisle || 'Pantry');

      if (!aggregated.has(key)) {
        aggregated.set(key, {
          name: INGREDIENT_ALIASES[ingredient.name.toLowerCase().trim()]
            ? key  // Use canonical name when alias was applied
            : ingredient.name,
          amounts: [],
          category,
          sourceRecipes: new Set(),
        });
      }

      const existing = aggregated.get(key)!;
      existing.amounts.push({ amount: adjustedAmount, unit, unitType });
      existing.sourceRecipes.add(entry.title);
    }
  }

  // Convert to final format with combined amounts
  const result: AggregatedIngredient[] = [];

  for (const [, data] of aggregated) {
    // Group amounts by unit type
    const volumeAmounts: number[] = [];
    const weightAmounts: number[] = [];
    const countAmounts: { amount: number; unit: string }[] = [];
    const otherAmounts: { amount: number; unit: string }[] = [];

    for (const { amount, unit, unitType } of data.amounts) {
      if (unitType === 'volume') {
        const converted = convertToBase(amount, unit);
        if (converted) volumeAmounts.push(converted.amount);
      } else if (unitType === 'weight') {
        const converted = convertToBase(amount, unit);
        if (converted) weightAmounts.push(converted.amount);
      } else if (unitType === 'count') {
        countAmounts.push({ amount, unit });
      } else {
        otherAmounts.push({ amount, unit });
      }
    }

    // Combine and convert back
    let totalAmount = 0;
    let finalUnit = '';

    if (volumeAmounts.length > 0) {
      const total = volumeAmounts.reduce((a, b) => a + b, 0);
      const converted = convertFromBase(total, 'ml');
      totalAmount = converted.amount;
      finalUnit = converted.unit;
    } else if (weightAmounts.length > 0) {
      const total = weightAmounts.reduce((a, b) => a + b, 0);
      const converted = convertFromBase(total, 'g');
      totalAmount = converted.amount;
      finalUnit = converted.unit;
    } else if (countAmounts.length > 0) {
      // Normalize all count amounts to individual items before summing
      // e.g. 1 dozen + 3 = 12 + 3 = 15
      totalAmount = countAmounts.reduce((sum, c) => {
        const multiplier = COUNT_MULTIPLIERS[normalizeUnit(c.unit)] ?? 1;
        return sum + c.amount * multiplier;
      }, 0);
      finalUnit = '';
    } else if (otherAmounts.length > 0) {
      // Can't combine different unknown units, just take the first
      totalAmount = otherAmounts[0].amount;
      finalUnit = otherAmounts[0].unit;
    }

    result.push({
      name: data.name,
      totalAmount: parseFloat(formatAmount(totalAmount)),
      unit: finalUnit,
      category: data.category,
      sourceRecipes: Array.from(data.sourceRecipes),
    });
  }

  // Sort by category then name
  result.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  return result;
}
