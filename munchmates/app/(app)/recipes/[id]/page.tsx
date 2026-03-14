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

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { authedFetch } from "@/lib/authedFetch";
import {
  ArrowLeft,
  Clock,
  Users,
  Heart,
  Star,
  Utensils,
  Check,
  FolderHeart,
  ChefHat,
  Minus,
  Plus,
} from "lucide-react";
import AddToCollectionDialog, { useAddToCollection } from '@/components/recipes/AddToCollectionDialog';
import CookConfirmModal, { useCookModal } from '@/components/cook/CookConfirmModal';
import { formatAmount } from '@/lib/unit-conversion';

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
  }>;
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
  const [instructions, setInstructions] = useState<InstructionStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
    new Set()
  );

  const collectionDialog = useAddToCollection();
  const cookModal = useCookModal();
  const [displayServings, setDisplayServings] = useState<number>(1);

  useEffect(() => {
    const fetchRecipeData = async () => {
      if (!recipeId) return;

      setIsLoading(true);
      setError(null);

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
            setIsSaved(savedIds.has(parseInt(recipeId)));
          }
        } else {
          const [infoRes, instructionsRes, savedRes] = await Promise.all([
            fetch(`/api/spoonacular/recipes/information?id=${recipeId}`),
            fetch(
              `/api/spoonacular/recipes/searchRecipeInstructions?id=${recipeId}`
            ),
            authedFetch("/api/recipes/saved"),
          ]);

          let infoData: any = null;
          if (infoRes.ok) {
            infoData = await infoRes.json();
            setRecipe(infoData);
            setDisplayServings(infoData.servings || 1);
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
            setIsSaved(savedIds.has(parseInt(recipeId)));
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
    <div className="min-h-full bg-background">
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
                  onClick={() => recipe && cookModal.openModal(recipe, displayServings)}
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
                    onClick={() => setDisplayServings(Math.max(1, displayServings - 1))}
                    disabled={displayServings <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className={`font-semibold tabular-nums ${displayServings !== recipe.servings ? 'text-primary' : ''}`}>
                    {displayServings}
                  </span>
                  <button
                    className="h-5 w-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    onClick={() => setDisplayServings(displayServings + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <span className="text-muted-foreground">servings</span>
                </div>
              )}
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
                  {recipe.extendedIngredients!.map((ingredient, index) => {
                    const checked = checkedIngredients.has(index);
                    const scale = recipe.servings ? displayServings / recipe.servings : 1;
                    const scaledAmount = ingredient.amount * scale;
                    const displayText = ingredient.amount > 0
                      ? `${formatAmount(scaledAmount)} ${ingredient.unit} ${ingredient.name}`.trim()
                      : ingredient.original;
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
                          {displayText}
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
  );
}
