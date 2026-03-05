'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';
import Link from 'next/link';
import { authedFetch } from '@/lib/authedFetch';
import RecipeCard from '@/components/recipes/RecipeCard';
import { RecipeGridSkeleton } from '@/components/recipes/RecipeCardSkeleton';

type CustomRecipe = {
    id: number;
    title: string;
    image?: string;
    servings: number;
    readyInMinutes: number;
    dishTypes: string[];
    cuisines: string[];
};

let cachedRecipes: CustomRecipe[] | null = null;

const MyRecipesPage = () => {
    const [recipes, setRecipes] = useState<CustomRecipe[]>(cachedRecipes ?? []);
    const [isLoading, setIsLoading] = useState(!cachedRecipes);

    useEffect(() => {
        let cancelled = false;
        const loadRecipes = async () => {
            try {
                const res = await authedFetch('/api/recipes/create');
                if (cancelled) return;
                if (res.status === 401) {
                    setTimeout(loadRecipes, 300);
                    return;
                }
                if (res.ok) {
                    const data = await res.json();
                    const mapped = (data.recipes || []).map((r: any) => ({
                        id: r.id,
                        title: r.title,
                        image: r.image || undefined,
                        servings: r.servings,
                        readyInMinutes: r.readyInMinutes,
                        dishTypes: r.dishTypes || [],
                        cuisines: r.cuisines || [],
                    }));
                    cachedRecipes = mapped;
                    setRecipes(mapped);
                }
            } catch (error) {
                console.error('Error loading custom recipes:', error);
            }
            if (!cancelled) setIsLoading(false);
        };
        loadRecipes();
        return () => { cancelled = true; };
    }, []);

    const handleDelete = async (recipeId: number) => {
        setRecipes(prev => {
            const next = prev.filter(r => r.id !== recipeId);
            cachedRecipes = next;
            return next;
        });
        try {
            await authedFetch(`/api/recipes/create?id=${recipeId}`, { method: 'DELETE' });
        } catch (error) {
            console.error('Error deleting recipe:', error);
        }
    };

    return (
        <div>
            {isLoading ? (
                <RecipeGridSkeleton />
            ) : recipes.length === 0 ? (
                <div className="relative overflow-hidden rounded-2xl py-16 flex flex-col items-center text-center"
                     style={{ background: 'linear-gradient(135deg, hsl(14 80% 52% / 0.10) 0%, hsl(30 90% 55% / 0.08) 50%, hsl(350 70% 60% / 0.05) 100%)' }}>
                    <Plus className="h-10 w-10 text-primary/40 mb-4" />
                    <h3 className="text-lg font-semibold mb-1">No custom recipes yet</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mb-6">
                        Create your own recipes and they&apos;ll show up here!
                    </p>
                    <Link href="/recipes/create">
                        <Button className="rounded-full">
                            <Plus className="h-4 w-4 mr-1" />
                            Create Recipe
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                <div className="flex justify-end">
                    <Link href="/recipes/create">
                        <Button className="rounded-full">
                            <Plus className="h-4 w-4 mr-1" />
                            Create Recipe
                        </Button>
                    </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {recipes.map((recipe) => (
                        <RecipeCard
                            key={recipe.id}
                            id={recipe.id}
                            title={recipe.title}
                            image={recipe.image}
                            readyInMinutes={recipe.readyInMinutes}
                        >
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDelete(recipe.id);
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/70 text-white backdrop-blur-sm hover:bg-red-500/90 transition-colors"
                                title="Delete recipe"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </RecipeCard>
                    ))}
                </div>
                </div>
            )}

        </div>
    );
};

export default MyRecipesPage;
