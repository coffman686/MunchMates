// Saved Recipes Page
// Displays the user's saved/favorited recipes and allows managing them.
// Features:
// - Fetches saved recipes from `/api/recipes/saved` via `authedFetch`
// - Responsive card grid with recipe images and saved-date display
// - Remove saved recipe with optimistic UI update
// - Add recipe to a shared collection via dialog with collection picker
// - Lazy-loads shared collections list when the dialog is opened
// - Empty state prompting the user to browse and save recipes

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Heart,
    Trash2,
    FolderHeart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authedFetch } from '@/lib/authedFetch';
import RecipeCard from '@/components/recipes/RecipeCard';
import { RecipeGridSkeleton } from '@/components/recipes/RecipeCardSkeleton';
import AddToCollectionDialog, { useAddToCollection } from '@/components/recipes/AddToCollectionDialog';

type SavedRecipe = {
    recipeId: number;
    recipeName: string;
    recipeImage?: string;
    savedAt?: string;
};

let cachedSavedRecipes: SavedRecipe[] | null = null;

const SavedRecipesPage = () => {
    const router = useRouter();
    const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>(cachedSavedRecipes ?? []);
    const [isLoading, setIsLoading] = useState(!cachedSavedRecipes);
    const collectionDialog = useAddToCollection();

    useEffect(() => {
        let cancelled = false;
        const loadSavedRecipes = async () => {
            try {
                const res = await authedFetch('/api/recipes/saved');
                if (cancelled) return;
                if (res.status === 401) {
                    setTimeout(loadSavedRecipes, 300);
                    return;
                }
                if (res.ok) {
                    const data = await res.json();
                    const recipes = data.recipes || [];
                    cachedSavedRecipes = recipes;
                    setSavedRecipes(recipes);
                }
            } catch (err) {
                console.error('Error loading saved recipes:', err);
            }
            if (!cancelled) setIsLoading(false);
        };
        loadSavedRecipes();
        return () => { cancelled = true; };
    }, []);

    const handleRemoveSavedRecipe = async (recipeId: number) => {
        setSavedRecipes(prev => {
            const next = prev.filter((r) => r.recipeId !== recipeId);
            cachedSavedRecipes = next;
            return next;
        });
        try {
            await authedFetch(`/api/recipes/saved?recipeId=${recipeId}`, { method: 'DELETE' });
        } catch (err) {
            console.error('Error removing saved recipe:', err);
        }
    };

    return (
        <div>
            {isLoading ? (
                <RecipeGridSkeleton />
            ) : savedRecipes.length === 0 ? (
                <div className="relative overflow-hidden rounded-2xl py-16 flex flex-col items-center text-center"
                     style={{ background: 'linear-gradient(135deg, hsl(14 80% 52% / 0.10) 0%, hsl(30 90% 55% / 0.08) 50%, hsl(350 70% 60% / 0.05) 100%)' }}>
                    <Heart className="h-10 w-10 text-red-400/60 mb-4" />
                    <h3 className="text-lg font-semibold mb-1">No saved recipes yet</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mb-6">
                        Start exploring recipes and save your favorites!
                    </p>
                    <Button className="rounded-full" onClick={() => router.push('/recipes')}>
                        Browse Recipes
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {savedRecipes.map((recipe) => (
                        <RecipeCard
                            key={recipe.recipeId}
                            id={recipe.recipeId}
                            title={recipe.recipeName}
                            image={recipe.recipeImage}
                        >
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    collectionDialog.openDialog({ id: recipe.recipeId, title: recipe.recipeName, image: recipe.recipeImage });
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
                                title="Add to collection"
                            >
                                <FolderHeart className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRemoveSavedRecipe(recipe.recipeId);
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/70 text-white backdrop-blur-sm hover:bg-red-500/90 transition-colors"
                                title="Remove from saved"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </RecipeCard>
                    ))}
                </div>
            )}

            <AddToCollectionDialog isOpen={collectionDialog.isOpen} onOpenChange={collectionDialog.setIsOpen} recipe={collectionDialog.recipe} />
        </div>
    );
};

export default SavedRecipesPage;
