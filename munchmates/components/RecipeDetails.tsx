// RecipeDetails Component
// Displays full recipe information inside the slideover or standalone view.
// Fetches recipe data by checking the local DB first (custom recipes), then
// falling back to Spoonacular API routes if not found locally.
// Handles loading states, error states, and API-limit errors gracefully.
// Provides a "Save Recipe" toggle backed by the saved-recipes API.
// Renders summary, badges, stats, ingredients, and step-by-step instructions.
// Custom recipes use plain-text instructions (no structured steps from Spoonacular).
// Automatically cleans HTML from summary text and falls back to raw HTML instructions.
// Supports being closed via router.back() or parent callback (onClose).
// Consumes recipeId passed in by parent route or intercepted slideover.

"use client";

import { useState, useEffect } from "react";
import {
  ChefHat,
  Clock,
  Users,
  Leaf,
  Heart,
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/authedFetch";

type RecipeDetailsProps = {
  recipeId: string | null;
  onClose?: () => void;
};

type InstructionStep = {
  number: number;
  step: string;
  ingredients?: { id: number; name: string; image: string }[];
  equipment?: { id: number; name: string; image: string }[];
};

type AnalyzedInstruction = {
  name: string;
  steps: InstructionStep[];
};

type RecipeInfo = {
  id: number;
  title: string;
  image?: string;
  readyInMinutes?: number;
  servings?: number;
  cuisines?: string[];
  dishTypes?: string[];
  diets?: string[];
  vegetarian?: boolean;
  vegan?: boolean;
  glutenFree?: boolean;
  dairyFree?: boolean;
  healthScore?: number;
  summary?: string;
  instructions?: string;
  extendedIngredients?: {
    id: number;
    name: string;
    amount: number;
    unit: string;
    original: string;
  }[];
};

export default function RecipeDetails({ recipeId, onClose }: RecipeDetailsProps) {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [recipeInfo, setRecipeInfo] = useState<RecipeInfo | null>(null);
  const [instructions, setInstructions] = useState<AnalyzedInstruction[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recipeId) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Try local DB first — if the recipe exists as a custom recipe, use it.
        // Otherwise fall back to Spoonacular. This avoids relying on ID ranges
        // since Spoonacular IDs can overlap with custom recipe IDs.
        const customRes = await authedFetch(`/api/recipes/create?id=${recipeId}`);
        const isCustom = customRes.ok;

        if (isCustom) {
          // Custom recipe found in local DB
          const data = await customRes.json();
          setRecipeInfo(data.recipe);
          // No structured instructions for custom recipes — plain text fallback used
        } else {
          // Not a custom recipe — fetch from Spoonacular
          const [infoRes, instructionsRes] = await Promise.all([
            fetch(`/api/spoonacular/recipes/information?id=${recipeId}`),
            fetch(`/api/spoonacular/recipes/searchRecipeInstructions?id=${recipeId}`),
          ]);

          let infoData: any = null;
          if (infoRes.ok) {
            infoData = await infoRes.json();
            setRecipeInfo(infoData);
          } else {
            try {
              infoData = await infoRes.json();
            } catch {
              // ignore JSON parse error
            }
            if (infoRes.status === 402 || infoData?.error?.includes("limit")) {
              throw new Error("API daily limit reached. Please try again tomorrow.");
            }
            throw new Error(infoData?.error || "Failed to fetch recipe details");
          }

          if (instructionsRes.ok) {
            const instructionsData = await instructionsRes.json();
            setInstructions(instructionsData.instructions || []);
          }
        }
      } catch (err) {
        console.error("Error fetching recipe:", err);
        setError(err instanceof Error ? err.message : "Failed to load recipe details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [recipeId]);

  useEffect(() => {
    if (!recipeId) return;
    let cancelled = false;

    const checkSaved = async () => {
      try {
        const res = await authedFetch('/api/recipes/saved');
        if (cancelled) return;
        if (res.status === 401) {
          setTimeout(checkSaved, 300);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          const recipes = data.recipes || [];
          setIsSaved(recipes.some((r: any) => String(r.recipeId) === String(recipeId)));
        }
      } catch {
        // silently fail
      }
    };
    checkSaved();
    return () => { cancelled = true; };
  }, [recipeId]);


  const handleSaveToggle = async () => {
    if (!recipeInfo) return;

    if (isSaved) {
      setIsSaved(false);
      try {
        await authedFetch(`/api/recipes/saved?recipeId=${recipeInfo.id}`, { method: 'DELETE' });
      } catch {
        setIsSaved(true);
      }
    } else {
      setIsSaved(true);
      try {
        await authedFetch('/api/recipes/saved', {
          method: 'POST',
          body: JSON.stringify({
            recipeId: recipeInfo.id,
            recipeName: recipeInfo.title,
            recipeImage: recipeInfo.image,
          }),
        });
      } catch {
        setIsSaved(false);
      }
    }
  };


  const handleClose = () => {
    if (onClose) onClose();
    else router.back();
  };

  // Clean HTML from summary
  const cleanSummary =
    recipeInfo?.summary?.replace(/<[^>]*>/g, "") || "";

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <ChefHat className="h-12 w-12 text-muted-foreground animate-spin mb-4" />
        <h3 className="text-lg font-semibold">Loading recipe...</h3>
      </div>
    );
  }

  if (error || !recipeInfo) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h3 className="text-lg font-semibold text-red-500">
          {error || "Recipe not found"}
        </h3>
        <Button variant="outline" onClick={handleClose}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 max-h-[100vh] overflow-y-auto">
      {/* Sticky header for slideover use */}
      <div className="sticky top-0 bg-background z-10 flex items-center gap-3 py-2 border-b mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h2 className="text-lg font-bold truncate flex-1">
          {recipeInfo.title}
        </h2>
        <Button
          variant={isSaved ? "secondary" : "outline"}
          size="icon"
          onClick={handleSaveToggle}
          aria-label={isSaved ? "Unsave recipe" : "Save recipe"}
        >
          {isSaved ? (
            <BookmarkCheck className="h-4 w-4" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Image */}
      {recipeInfo.image && (
        <div className="w-full h-48 sm:h-64 rounded-lg overflow-hidden">
          <img
            src={recipeInfo.image}
            alt={recipeInfo.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Quick stats */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {recipeInfo.readyInMinutes && (
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{recipeInfo.readyInMinutes} min</span>
          </div>
        )}
        {recipeInfo.servings && (
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{recipeInfo.servings} servings</span>
          </div>
        )}
        {recipeInfo.healthScore && (
          <div className="flex items-center gap-1">
            <Heart className="h-4 w-4" />
            <span>Health Score: {recipeInfo.healthScore}</span>
          </div>
        )}
      </div>

      {/* Diet badges */}
      <div className="flex flex-wrap gap-2">
        {recipeInfo.vegetarian && (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <Leaf className="h-3 w-3 mr-1" />
            Vegetarian
          </Badge>
        )}
        {recipeInfo.vegan && (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <Leaf className="h-3 w-3 mr-1" />
            Vegan
          </Badge>
        )}
        {recipeInfo.glutenFree && (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            Gluten-Free
          </Badge>
        )}
        {recipeInfo.dairyFree && (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Dairy-Free
          </Badge>
        )}
        {recipeInfo.cuisines?.map((cuisine) => (
          <Badge key={cuisine} variant="outline">
            {cuisine}
          </Badge>
        ))}
        {recipeInfo.dishTypes?.slice(0, 3).map((type) => (
          <Badge key={type} variant="outline">
            {type}
          </Badge>
        ))}
      </div>

      {/* Summary */}
      {cleanSummary && (
        <>
          <Separator />
          <div>
            <h2 className="text-lg font-semibold mb-2">About</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {cleanSummary.length > 300
                ? cleanSummary.substring(0, 300) + "..."
                : cleanSummary}
            </p>
          </div>
        </>
      )}

      {/* Ingredients */}
      {recipeInfo.extendedIngredients &&
        recipeInfo.extendedIngredients.length > 0 && (
          <>
            <Separator />
            <div>
              <h2 className="text-lg font-semibold mb-3">Ingredients</h2>
              <ul className="space-y-2">
                {recipeInfo.extendedIngredients.map((ingredient, index) => (
                    <li
                        key={ingredient.id || index}
                        className="flex items-start gap-2 text-sm"
                  >
                    <span className="text-primary font-medium">•</span>
                    <span>
                      {ingredient.original ||
                        `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

      {/* Instructions */}
      {instructions.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="text-lg font-semibold mb-3">Instructions</h2>
            <ol className="space-y-4">
              {instructions.flatMap((instruction) =>
                instruction.steps.map((step) => (
                  <li key={step.number} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-medium">
                      {step.number}
                    </span>
                    <p className="text-sm leading-relaxed pt-0.5">
                      {step.step}
                    </p>
                  </li>
                ))
              )}
            </ol>
          </div>
        </>
      )}

      {/* Fallback HTML instructions */}
      {instructions.length === 0 && recipeInfo.instructions && (
        <>
          <Separator />
          <div>
            <h2 className="text-lg font-semibold mb-3">Instructions</h2>
            <div
              className="text-sm leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: recipeInfo.instructions }}
            />
          </div>
        </>
      )}
    </div>
  );
}
