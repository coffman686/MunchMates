// File: RecipeDetailPage
// Purpose: Render the full details for a specific recipe ID
// Inputs: recipeId extracted from the URL path
// Outputs: Full recipe view including metadata, ingredients, and instructions
// Fetches recipe information, instructions, and saved-status
// Supports both Spoonacular recipes and custom user-created recipes.
// Checks the local DB first — if found, it's a custom recipe fetched from
// /api/recipes/create. Otherwise falls back to Spoonacular.
// Custom recipes use plain-text instructions (no structured steps).
// Allows user to save/unsave recipes
// Handles redirect if route matches /recipes/saved

"use client";


import {
  ArrowLeft,
  Check,
  ChefHat,
  Clock,
  FolderHeart,
  Heart,
  Minus,
  Plus,
  Star,
  Users,
  Utensils,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CookConfirmModal, { useCookModal } from '@/components/cook/CookConfirmModal';
import AddToCollectionDialog, { useAddToCollection } from '@/components/recipes/AddToCollectionDialog';
import { authedFetch } from "@/lib/authedFetch";
import { formatAmount } from '@/lib/unit-conversion';

type NutritionInfo = {
  calories: string;
  carbs: string;
  fat: string;
  protein: string;
};

type RecipeInfo = {
  id: number;
  title: string;
  image?: string;
  readyInMinutes?: number;
  servings?: number;
  sourceUrl?: string;
  spoonacularScore?: number;
  cuisines?: string[];
  dishTypes?: string[];
  diets?: string[];
  vegan?: boolean;
  vegetarian?: boolean;
  glutenFree?: boolean;
  dairyFree?: boolean;
  veryHealthy?: boolean;
  cheap?: boolean;
  summary?: string;
  instructions?: string;
  extendedIngredients?: Array<{
    id: number;
    name: string;
    amount: number;
    unit: string;
    original: string;
    aisle?: string;
    metaInformation?: string[];
  }>;
  nutrition?: {
    nutrients?: Array<{ name: string; amount: number; unit: string }>;
  };
};

type InstructionStep = {
  number: number;
  step: string;
  ingredients?: Array<{ id: number; name: string; image: string }>;
  equipment?: Array<{ id: number; name: string; image: string }>;
};

// --- Filter out blog spam from scraped instructions ---
const SPAM_PATTERNS = [
  /\bnewsletter\b/i,
  /\bsubscrib/i,
  /\bsign\s*up\b/i,
  /\bsocial\s*media\b/i,
  /\bfacebook\b/i,
  /\binstagram\b/i,
  /\bpinterest\b/i,
  /\btwitter\b/i,
  /\bemail\s*address\b/i,
  /\bpowered\s*by\b/i,
  /\bjoin\s+over\b/i,
  /\bdon't\s*miss\b/i,
  /\bfollow\s+(along|us|me)\b/i,
  /\bprivate\s+facebook\b/i,
  /\bdownload\b.*\bebook\b/i,
  /\bconfirm\s+your\s+subscription\b/i,
  /love\s+this\s+recipe\b/i,
  /\bwhat\s+do\s+you\s+(usually|normally|like\s+to)\b/i,
  /\bjoin\s+(us|in)\b/i,
  /\bcheck\s+out\s+(my|our)\b/i,
];

const COOKING_WORDS =
  /\b(add|bake|baste|beat|blend|boil|braise|broil|brown|brush|carve|chill|chop|coat|combine|cook|cool|cover|cream|crush|cube|cut|deglaze|dice|dissolve|drain|drizzle|dust|fillet|flip|fold|freeze|fry|garnish|grate|grill|heat|julienne|knead|layer|let|line|marinate|mash|measure|melt|mince|mix|oil|peel|place|plate|poach|pour|preheat|press|puree|reduce|refrigerate|remove|rinse|roast|roll|rub|saute|saut|scramble|season|serve|set|shred|sift|simmer|skim|slice|soak|spread|sprinkle|squeeze|steam|stew|stir|strain|stuff|tenderize|toast|top|toss|transfer|trim|turn|wash|whip|whisk|wrap|zest)\b/i;

function isSpamStep(step: string): boolean {
  if (SPAM_PATTERNS.some((p) => p.test(step))) return true;
  // Very short steps with no cooking-related words are likely junk,
  // but skip section headers like "For the cake:" or "For the Frosting:"
  if (step.length < 40 && !COOKING_WORDS.test(step) && !step.trimEnd().endsWith(":")) return true;
  return false;
}

/** Keep steps until the first spam step is encountered */
function filterInstructions(steps: InstructionStep[]): InstructionStep[] {
  const clean: InstructionStep[] = [];
  for (const step of steps) {
    if (isSpamStep(step.step)) break;
    clean.push(step);
  }
  return clean;
}

/** Parse HTML <li> instructions into structured steps, skipping section headers */
function parseHtmlInstructions(html: string): InstructionStep[] {
  const liRegex = /<li>(.*?)<\/li>/gi;
  const steps: InstructionStep[] = [];
  let match;
  let num = 1;
  while ((match = liRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]*>/g, "").trim();
    // Skip empty items and section headers like "For the cake:"
    if (!text || /^for\s+the\s+\w+.*:$/i.test(text)) continue;
    steps.push({ number: num++, step: text });
  }
  return steps;
}

// --- Skeleton Loading State ---
function RecipeSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        <div className="h-9 w-9 rounded-full bg-muted mb-4" />
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 rounded-2xl bg-muted/40 border p-6 sm:p-8 space-y-4">
            <div className="h-9 w-3/4 bg-muted rounded" />
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-5 w-20 rounded bg-muted" />
              ))}
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 w-16 rounded-full bg-muted" />
              ))}
            </div>
          </div>
          <div className="md:w-80 lg:w-96 min-h-[240px] rounded-2xl bg-muted" />
        </div>
      </div>

      {/* About skeleton */}
      <div className="px-4 sm:px-6 lg:px-8 pb-2">
        <div className="rounded-2xl border bg-muted/40 p-6 sm:p-8 space-y-3">
          <div className="h-7 w-48 bg-muted rounded" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-5/6" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
      </div>

      {/* Two-column skeleton */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="md:w-[60%] space-y-6">
            <div className="h-8 w-40 bg-muted rounded" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
          <div className="md:w-[40%] space-y-3">
            <div className="h-8 w-36 bg-muted rounded" />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-12 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Diet badge color map ---
function getDietBadgeClass(diet: string): string {
  const lower = diet.toLowerCase();
  if (lower.includes("vegan") || lower.includes("vegetarian"))
    return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  if (lower.includes("gluten"))
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  if (lower.includes("dairy"))
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  if (lower.includes("healthy"))
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  return "bg-muted text-muted-foreground";
}

function getDietLabels(recipe: RecipeInfo): string[] {
  const labels: string[] = [];
  if (recipe.vegan) labels.push("Vegan");
  else if (recipe.vegetarian) labels.push("Vegetarian");
  if (recipe.glutenFree) labels.push("Gluten-Free");
  if (recipe.dairyFree) labels.push("Dairy-Free");
  if (recipe.veryHealthy) labels.push("Very Healthy");
  return labels;
}

function detectAllergens(recipe: RecipeInfo | null): string[] {
  if (!recipe) return [];

  const possibleAllergens: { name: string; patterns: RegExp[] }[] = [
    { name: 'Gluten', patterns: [/\bgluten\b/i, /\bwheat\b/i, /\bbarley\b/i, /\brye\b/i, /\bflour\b/i] },
    { name: 'Dairy', patterns: [/\b(dairy|milk|cheese|butter|yogurt|cream|casein|whey|custard)\b/i] },
    { name: 'Egg', patterns: [/\b(egg|mayonnaise|meringue|albumin)\b/i] },
    { name: 'Peanut', patterns: [/\b(peanut|peanut butter)\b/i] },
    { name: 'Tree Nut', patterns: [/\b(almond|walnut|pecan|cashew|hazelnut|pistachio|macadamia|tree nut)\b/i] },
    { name: 'Seafood', patterns: [/\b(fish|salmon|tuna|cod|trout|haddock|anchovy)\b/i] },
    { name: 'Shellfish', patterns: [/\b(shrimp|prawn|crab|lobster|oyster|mussel|scallop)\b/i] },
    { name: 'Soy', patterns: [/\b(soy|soybean|tofu|tempeh|edamame|soy sauce)\b/i] },
    { name: 'Sesame', patterns: [/\b(sesame|tahini)\b/i] },
    { name: 'Sulfite', patterns: [/\b(sulfite|sulphite)\b/i] },
  ];

  const ingredientText = (recipe.extendedIngredients || [])
    .map((ingredient) => [ingredient.name, ingredient.aisle || '', ingredient.original || '', ...(ingredient.metaInformation || [])].join(' '))
    .join(' ');

  const found = new Set<string>();

  if (recipe.glutenFree === false) found.add('Gluten');
  if (recipe.dairyFree === false) found.add('Dairy');

  possibleAllergens.forEach((allergen) => {
    if (allergen.patterns.some((pattern) => pattern.test(ingredientText))) {
      found.add(allergen.name);
    }
  });

  return Array.from(found);
}

function getAllergenBadgeClass(allergen: string): string {
  return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
}

// --- Main Component ---
export default function RecipeDetailPage() {
  const pathname = usePathname();
  const recipeId = pathname.split("/").pop();

  // Read the page the user came from (set by RecipeCard on click)
  const [backHref, setBackHref] = useState("/recipes");
  useEffect(() => {
    const prev = sessionStorage.getItem("mm_back");
    if (prev && prev !== pathname) {
      setBackHref(prev);
    }
  }, [pathname]);

  const [recipe, setRecipe] = useState<RecipeInfo | null>(null);
  const [nutrition, setNutrition] = useState<NutritionInfo | null>(null);
  const [instructions, setInstructions] = useState<InstructionStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
    new Set()
  );

  const collectionDialog = useAddToCollection();
  const cookModal = useCookModal();
  const [displayServings, setDisplayServings] = useState<number | string>(1);

  useEffect(() => {
    const fetchRecipeData = async () => {
      if (!recipeId) return;

      setIsLoading(true);
      setError(null);
      setNutrition(null);

      try {
        const customRes = await authedFetch(`/api/recipes/create?id=${recipeId}`);
        const isCustom = customRes.ok;

        if (isCustom) {
          const [data, savedRes] = await Promise.all([
            customRes.json(),
            authedFetch("/api/recipes/saved"),
          ]);
          setRecipe(data.recipe);
          setDisplayServings(data.recipe.servings || 1);

          // Parse numbered instructions into structured steps
          if (data.recipe.instructions) {
            const lines = data.recipe.instructions.split("\n").filter((l: string) => l.trim());
            const parsed: InstructionStep[] = lines.map((line: string, i: number) => ({
              number: i + 1,
              step: line.replace(/^\d+\.\s*/, "").trim(),
            }));
            if (parsed.length > 0) setInstructions(parsed);
          }

          if (savedRes.ok) {
            const savedData = await savedRes.json();
            const savedIds = new Set(
              savedData.recipes.map((r: any) => r.recipeId)
            );
            setIsSaved(savedIds.has(parseInt(recipeId, 10)));
          }
        } else {
          const [infoRes, instructionsRes, savedRes] = await Promise.all([
            authedFetch(`/api/spoonacular/recipes/information?id=${recipeId}`),
            authedFetch(
              `/api/spoonacular/recipes/searchRecipeInstructions?id=${recipeId}`
            ),
            authedFetch("/api/recipes/saved"),
          ]);

          let infoData: any = null;
          if (infoRes.ok) {
            infoData = await infoRes.json();
            setRecipe(infoData);
            setDisplayServings(infoData.servings || 1);

            // Fetch macro nutrition data (per serving) via nutrition widget endpoint
            try {
              const nutritionRes = await authedFetch(`/api/spoonacular/recipes/nutrition?id=${recipeId}`);
              if (nutritionRes.ok) {
                const nutritionJson = await nutritionRes.json();
                setNutrition(nutritionJson);
              } else {
                setNutrition(null);
              }
            } catch (nutritionErr) {
              console.warn('Failed to load nutrition data', nutritionErr);
              setNutrition(null);
            }
          } else {
            setError("Failed to load recipe information");
          }

          // Pick the best instruction source:
          // 1. analyzedInstructions endpoint (structured steps)
          // 2. HTML <li> instructions from the info endpoint
          // Use whichever has more steps after spam filtering.
          let analyzedSteps: InstructionStep[] = [];
          if (instructionsRes.ok) {
            const instructionsData = await instructionsRes.json();
            if (
              instructionsData.instructions &&
              instructionsData.instructions.length > 0
            ) {
              analyzedSteps = filterInstructions(
                instructionsData.instructions[0]?.steps || []
              );
            }
          }

          let htmlSteps: InstructionStep[] = [];
          if (infoData?.instructions) {
            htmlSteps = filterInstructions(
              parseHtmlInstructions(infoData.instructions)
            );
          }

          setInstructions(
            htmlSteps.length > analyzedSteps.length ? htmlSteps : analyzedSteps
          );

          if (savedRes.ok) {
            const savedData = await savedRes.json();
            const savedIds = new Set(
              savedData.recipes.map((r: any) => r.recipeId)
            );
            setIsSaved(savedIds.has(parseInt(recipeId, 10)));
          }
        }
      } catch (err) {
        console.error("Error fetching recipe:", err);
        setError("Failed to load recipe");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecipeData();
  }, [recipeId]);

  const recipeAllergens = useMemo(() => detectAllergens(recipe), [recipe]);

  const handleSaveRecipe = async () => {
    if (!recipe) return;

    try {
      if (isSaved) {
        await authedFetch(`/api/recipes/saved?recipeId=${recipe.id}`, {
          method: "DELETE",
        });
        setIsSaved(false);
      } else {
        await authedFetch("/api/recipes/saved", {
          method: "POST",
          body: JSON.stringify({
            recipeId: recipe.id,
            recipeName: recipe.title,
            recipeImage: recipe.image,
          }),
        });
        setIsSaved(true);
      }
    } catch (err) {
      console.error("Error saving recipe:", err);
    }
  };

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "");

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const scaledIngredients = useMemo(() => {
    if (!recipe?.extendedIngredients) {
      return []
    }

    return recipe.extendedIngredients.map((ingredient) => {
      const servings = parseFloat(displayServings.toString()) || recipe.servings || 1;
      const realServings = recipe.servings ? servings / recipe.servings : 1;
      const displayAmount = formatAmount(realServings * ingredient.amount)
        .replace(/ /, "\u202F")
        .replace(/\//, "\u2044");

      // replace fraction with our own
      const scaledOriginal = ingredient.original
        .normalize("NFKD")
        .replace(/^[0-9 /\-\u2044]+/, `${displayAmount} `);

      return {
        ...ingredient,
        original: scaledOriginal
      }
    })
  }, [recipe, displayServings])

  if (!recipeId) return null;

  // --- Error state ---
  if (error && !isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center px-6 py-16 max-w-md mx-auto rounded-3xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
          <Utensils className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{error}</h3>
          <p className="text-sm text-muted-foreground mb-6">
            We couldn&apos;t find this recipe. It may have been removed or the
            link is incorrect.
          </p>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Link>
        </div>
      </div>
    );
  }


  // --- Loading state ---
  if (isLoading) return <RecipeSkeleton />;

  if (!recipe) return null;

  const dietLabels = getDietLabels(recipe);

  const hasCuisineOrDish =
    (recipe.cuisines && recipe.cuisines.length > 0) ||
    (recipe.dishTypes && recipe.dishTypes.length > 0);
  const hasStructuredInstructions = instructions.length > 0;
  const hasPlainInstructions =
    !hasStructuredInstructions && !!recipe.instructions;
  const hasAnyInstructions = hasStructuredInstructions || hasPlainInstructions;
  const hasIngredients =
    recipe.extendedIngredients && recipe.extendedIngredients.length > 0;

  return (
    <>
      {/* Print-only section */}
      <div className="hidden print:block print:p-0 print:m-0 print:min-h-0 print:min-w-0 print:overflow-visible">
        <h1 className="print:text-2xl print:font-bold print:mb-2">{recipe.title}</h1>
        <div className="flex items-center gap-4 mb-4 text-sm">
          {recipe.spoonacularScore != null && recipe.spoonacularScore > 0 && (
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              <span className="font-semibold">{Math.round(recipe.spoonacularScore)}</span>
              <span className="text-muted-foreground">score</span>
            </div>
          )}
          {recipe.readyInMinutes != null && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-semibold">{recipe.readyInMinutes}</span>
              <span className="text-muted-foreground">min</span>
            </div>
          )}
          {recipe.servings != null && (
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-semibold">{recipe.servings}</span>
              <span className="text-muted-foreground">servings</span>
            </div>
          )}
        </div>
        {(dietLabels.length > 0 || hasCuisineOrDish) && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {dietLabels.map((label) => (
              <span
                key={label}
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getDietBadgeClass(label)}`}
              >
                {label}
              </span>
            ))}
            {recipe.cuisines?.map((cuisine) => (
              <span
                key={cuisine}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border bg-background/60 text-muted-foreground"
              >
                {cuisine}
              </span>
            ))}
            {recipe.dishTypes?.map((type) => (
              <span
                key={type}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border bg-background/60 text-muted-foreground"
              >
                {type}
              </span>
             ))}
          </div>
        )}
        {recipe.summary && (
          <div className="print:mb-4">
            <p className="print:text-base print:mb-4">{stripHtml(recipe.summary)}</p>
          </div>
        )}
        {hasIngredients && (
          <div className="print:mb-6">
            <h2 className="print:text-xl print:font-semibold print:mb-2">Ingredients</h2>
            <ul className="print:list-disc print:pl-6 print:text-base">
              {recipe.extendedIngredients?.map(ingredient => (
                <li key={ingredient.id}>{ingredient.original}</li>
              ))}
            </ul>
          </div>
        )}
        {hasAnyInstructions && (
          <div className="print:mb-6">
            <h2 className="print:text-xl print:font-semibold print:mb-2">Instructions</h2>
            {hasStructuredInstructions ? (
              <ol className="print:list-decimal print:pl-6 print:text-base">
                {instructions.map(step => (
                  <li key={step.number}>{step.step}</li>
                ))}
              </ol>
            ) : (
              <p className="print:text-base print:whitespace-pre-line">{stripHtml(recipe.instructions!)}</p>
            )}
          </div>
        )}
      </div>
    <div className="min-h-full bg-background print:hidden">
      {/* Header Section */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Back button */}
        <Link
          href={backHref}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors mb-4"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>

        <div className="flex flex-col md:flex-row gap-6 md:gap-8 md:items-stretch">
          {/* Left — Info card */}
          <div className="flex-1 min-w-0 rounded-2xl border bg-muted/40 p-6 sm:p-8 flex flex-col justify-center">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {recipe.title}
              </h1>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleSaveRecipe}
                    className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-background/80 transition-colors"
                  >
                    <Heart
                      className={`h-5 w-5 ${
                        isSaved
                          ? "fill-red-500 text-red-500"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => recipe && collectionDialog.openDialog({ id: recipe.id, title: recipe.title, image: recipe.image })}
                    className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-background/80 transition-colors"
                    title="Add to collection"
                  >
                    <FolderHeart className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (!recipe) return;
                    const cookServings =
                      typeof displayServings === 'number'
                        ? displayServings
                        : Number(displayServings) || 1;
                    cookModal.openModal(recipe, cookServings);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                >
                  <ChefHat className="h-3.5 w-3.5" />
                  I Cooked This
                </button>
              </div>
            </div>

            {/* Stat cards row */}
            <div className="flex items-center gap-4 mb-5 text-sm">
              {recipe.spoonacularScore != null && recipe.spoonacularScore > 0 && (
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span className="font-semibold">{Math.round(recipe.spoonacularScore)}</span>
                  <span className="text-muted-foreground">score</span>
                </div>
              )}
              {recipe.readyInMinutes != null && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{recipe.readyInMinutes}</span>
                  <span className="text-muted-foreground">min</span>
                </div>
              )}
              {recipe.servings != null && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary" />
                  <button
                    className="h-5 w-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    onClick={() => {
                      const servings = parseFloat(displayServings.toString()) || recipe.servings || 1;
                      setDisplayServings(Math.max(1, servings - 1))
                    }}
                    disabled={parseFloat(displayServings.toString()) <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className={`font-semibold tabular-nums ${displayServings !== recipe.servings ? 'text-primary' : ''}`}>

                  <input className="w-12 border text-center [appearance:textfield]" type="number" min="1" placeholder={recipe.servings.toString()} value={displayServings.toString()} onChange={(e) => {
                      setDisplayServings(parseFloat(e.target.value.toString()));
                    }}
                    />
                  </span>
                  <button
                    className="h-5 w-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    onClick={() => {
                      const servings = parseFloat(displayServings.toString()) || recipe.servings || 1;
                      setDisplayServings(servings + 1)
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <span className="text-muted-foreground">servings</span>
                </div>
              )}
            </div>

            {/* Nutrition / allergen hints */}
            <div className="grid grid-cols-2 gap-2 mb-4 text-xs md:text-sm">
              <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
                <h3 className="font-semibold text-xs text-slate-600 uppercase tracking-wider mb-1">Macros (per serving)</h3>
                {nutrition ? (
                  <ul className="space-y-1">
                    <li>Calories: <span className="font-semibold">{nutrition.calories}</span></li>
                    <li>Carbs: <span className="font-semibold">{nutrition.carbs}</span></li>
                    <li>Fat: <span className="font-semibold">{nutrition.fat}</span></li>
                    <li>Protein: <span className="font-semibold">{nutrition.protein}</span></li>
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Nutrition details not available.</p>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
                <h3 className="font-semibold text-xs text-slate-600 uppercase tracking-wider mb-1">Allergens</h3>
                {recipeAllergens.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {recipeAllergens.map((allergen) => (
                      <span key={allergen} className={getAllergenBadgeClass(allergen)}>
                        {allergen}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No common allergens detected.</p>
                )}
              </div>
            </div>

            {/* Diet + cuisine badges */}
            {(dietLabels.length > 0 || hasCuisineOrDish) && (
              <div className="flex flex-wrap items-center gap-2">
                {dietLabels.map((label) => (
                  <span
                    key={label}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getDietBadgeClass(label)}`}
                  >
                    {label}
                  </span>
                ))}
                {recipe.cuisines?.map((cuisine) => (
                  <span
                    key={cuisine}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border bg-background/60 text-muted-foreground"
                  >
                    {cuisine}
                  </span>
                ))}
                {recipe.dishTypes?.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border bg-background/60 text-muted-foreground"
                  >
                    {type}
                  </span>
                ))}
              </div>
            )}

          </div>

          {/* Right — Image */}
          <div className="w-full md:w-80 lg:w-96 flex-shrink-0">
            <div className="relative h-full min-h-[240px] rounded-2xl overflow-hidden border bg-muted shadow-sm">
              {recipe.image ? (
                <Image
                  src={recipe.image}
                  alt={recipe.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 100vw, 384px"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950">
                  <Utensils className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* About This Recipe */}
      {recipe.summary && (
        <div className="px-4 sm:px-6 lg:px-8 pb-2">
          <div className="rounded-2xl border bg-muted/40 p-6 sm:p-8">
            <h2 className="text-xl font-semibold mb-3">About This Recipe</h2>
            <p className="text-muted-foreground leading-7 text-[15px]">
              {stripHtml(recipe.summary)}
            </p>
          </div>
        </div>
      )}

      {/* Two-Column Layout — Instructions + Ingredients */}
      <div className="px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className={`flex flex-col-reverse gap-6 ${hasAnyInstructions ? "md:flex-row md:gap-8" : ""}`}>
          {/* Left Column — Instructions */}
          {hasAnyInstructions && (
            <div className="md:w-[60%]">
              <div className="rounded-2xl border bg-muted/40 p-6 sm:p-8">
                <h2 className="text-xl font-semibold mb-6">Instructions</h2>

                {hasStructuredInstructions ? (
                  <ol className="space-y-6">
                    {instructions.map((step) => (
                      <li key={step.number} className="flex gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                          {step.number}
                        </div>
                        <div className="flex-1 pt-1.5">
                          <p className="text-foreground leading-7 text-[15px]">
                            {step.step}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="whitespace-pre-line text-foreground leading-7 text-[15px]">
                    {stripHtml(recipe.instructions!)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Right Column — Ingredients (sticky) */}
          {hasIngredients && (
            <div className={hasAnyInstructions ? "md:w-[40%]" : "w-full"}>
              <div className="md:sticky md:top-6 rounded-2xl border bg-muted/40 p-6 sm:p-8">
                <h2 className="text-xl font-semibold mb-4">Ingredients</h2>
                <div className="space-y-1">
                  {scaledIngredients.map((ingredient, index) => {
                    const checked = checkedIngredients.has(index);
                    return (
                      <button
                        key={`${ingredient.id}-${index}`}
                        onClick={() => toggleIngredient(index)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors hover:bg-background/60 ${
                          checked ? "opacity-50" : ""
                        }`}
                      >
                        <div
                          className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                            checked
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {checked && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <span
                          className={`text-sm leading-snug ${
                            checked
                              ? "line-through text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {ingredient.original}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AddToCollectionDialog isOpen={collectionDialog.isOpen} onOpenChange={collectionDialog.setIsOpen} recipe={collectionDialog.recipe} />
      <CookConfirmModal
        isOpen={cookModal.isOpen}
        onOpenChange={cookModal.setIsOpen}
        recipe={cookModal.recipe}
        cookServings={cookModal.cookServings}
      />
    </div>
    </>
  );
}
