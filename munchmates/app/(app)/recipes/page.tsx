// Recipes Page
// Main recipes discovery screen for MunchMates.
// Supports ingredient-based search with autosuggest, cuisine and dish-type filters,
// and respects user dietary preferences/intolerances pulled from their profile.
// Integrates with Spoonacular search API for external recipes and a custom
// "Create Recipe" dialog that posts user-authored recipes to /api/recipes/create.
// Also manages favorite recipes via the saved-recipes API so users
// can toggle hearts in the grid and access them later from the Saved Recipes view.

'use client';

import { useState, useEffect, useRef, SetStateAction } from 'react';
import DynamicList from '@/components/ingredients/DynamicList';
import { authedFetch } from '@/lib/authedFetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Heart, FolderHeart } from 'lucide-react';
import AddToCollectionDialog, { useAddToCollection } from '@/components/recipes/AddToCollectionDialog';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { getDiets, getIntolerances } from '@/components/ingredients/Dietary';
import RecipeCard from '@/components/recipes/RecipeCard';
import { RecipeGridSkeleton } from '@/components/recipes/RecipeCardSkeleton';
import RecipeAutocomplete from '@/components/recipes/RecipeAutocomplete';

type SavedRecipe = {
    recipeId: number;
    recipeName: string;
    recipeImage?: string;
    savedAt: string;
};

type Recipe = {
    id: number;
    title: string;
    image: string;
    score: number;
    servings: number;
    readyInMinutes: number;
    cuisines: string[];
    dishTypes: string[];
    usedIngredients?: string[];
    missedIngredientCount?: number;
}

// Module-level cache to persist state across tab switches
let cachedRecipes: Recipe[] | null = null;
let cachedIngredientList: string[] | null = null;
let cachedSearchTerm: string | null = null;
let cachedNameQuery: string | null = null;
let cachedDishType: string | null = null;
let cachedCuisine: string | null = null;
let cachedPantryOnly: boolean | null = null;
let cachedSavedIds: Set<number> | null = null;

const Recipes = () => {
    const router = useRouter();
    const [recipes, setRecipes] = useState<Recipe[]>(cachedRecipes ?? []);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState(cachedSearchTerm ?? '');
    const [nameQuery, setNameQuery] = useState(cachedNameQuery ?? '');
    const [nameInput, setNameInput] = useState(cachedNameQuery ?? '');
    const [selectedDishType, setSelectedDishType] = useState(cachedDishType ?? 'All');
    const [selectedCuisine, setSelectedCuisine] = useState(cachedCuisine ?? 'All');
    const [diet, setDiet] = useState("");
    const [intolerances, setIntolerances] = useState("");
    const [pantryOnly, setPantryOnly] = useState(cachedPantryOnly ?? false);

    const collectionDialog = useAddToCollection();

    // Skip first fetch if we have cached results (restoring from tab switch)
    const isRestoringRef = useRef(cachedRecipes !== null);

    const dishTypes = ['All', 'main course', 'side dish', 'dessert', 'appetizer', 'salad', 'bread', 'breakfast', 'soup', 'beverage', 'sauce', 'marinade', 'fingerfood', 'snack', 'drink'];

    const cuisines = ['All', 'African', 'Asian', 'American', 'British', 'Cajun', 'Caribbean', 'Chinese', 'Eastern European', 'European', 'French', 'German', 'Greek', 'Indian', 'Irish', 'Italian', 'Japanese', 'Jewish', 'Korean', 'Latin American', 'Mediterranean', 'Mexican', 'Middle Eastern', 'Nordic', 'Southern', 'Spanish', 'Thai', 'Vietnamese'];

    const fetchRecipes = async () => {
        if (!searchTerm && !nameQuery) {
            setRecipes([]);
            return;
        }

        setIsLoading(true);

        const params = new URLSearchParams();
        if (searchTerm) params.set('ingredients', searchTerm);
        if (nameQuery) params.set('query', nameQuery);
        if (selectedCuisine !== 'All') params.set('cuisine', selectedCuisine);
        if (selectedDishType !== 'All') params.set('dishType', selectedDishType);
        if (diet) params.set('diet', diet);
        if (intolerances) params.set('intolerances', intolerances);

        try {
            const response = await fetch(`/api/spoonacular/recipes/searchByIngredient?${params.toString()}`);
            const data = await response.json();
            setRecipes(data.results || []);
        } catch (error) {
            console.error('Error fetching recipes:', error);
            setRecipes([]);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        setDiet(getDiets())
        setIntolerances(getIntolerances())
    }, []);

    useEffect(() => {
        if (isRestoringRef.current) {
            isRestoringRef.current = false;
            return;
        }
        fetchRecipes()
    }, [searchTerm, nameQuery, selectedCuisine, selectedDishType, diet, intolerances])

    const handleCombinedSearch = () => {
        setDiet(getDiets());
        setIntolerances(getIntolerances());
        setNameQuery(nameInput);
        setSearchTerm(ingredientList.length > 0 ? ingredientList.join(',').toLowerCase() : '');
    };

    const [ingredientList, setIngredientList] = useState<string[]>(cachedIngredientList ?? []);

    const [savedRecipeIds, setSavedRecipeIds] = useState<Set<number>>(cachedSavedIds ?? new Set());

    // Sync state to module-level cache
    useEffect(() => { cachedRecipes = recipes; }, [recipes]);
    useEffect(() => { cachedIngredientList = ingredientList; }, [ingredientList]);
    useEffect(() => { cachedSearchTerm = searchTerm; }, [searchTerm]);
    useEffect(() => { cachedNameQuery = nameQuery; }, [nameQuery]);
    useEffect(() => { cachedDishType = selectedDishType; }, [selectedDishType]);
    useEffect(() => { cachedCuisine = selectedCuisine; }, [selectedCuisine]);
    useEffect(() => { cachedPantryOnly = pantryOnly; }, [pantryOnly]);
    useEffect(() => { cachedSavedIds = savedRecipeIds; }, [savedRecipeIds]);

    useEffect(() => {
        let cancelled = false;
        const loadSaved = async () => {
            try {
                const res = await authedFetch('/api/recipes/saved');
                if (cancelled) return;
                if (res.status === 401) {
                    setTimeout(loadSaved, 300);
                    return;
                }
                if (res.ok) {
                    const data = await res.json();
                    const recipes: SavedRecipe[] = data.recipes || [];
                    setSavedRecipeIds(new Set(recipes.map(r => r.recipeId)));
                }
            } catch (error) {
                console.error('Error loading saved recipes:', error);
            }
        };
        loadSaved();
        return () => { cancelled = true; };
    }, []);

    const handleSaveRecipe = async (recipeId: number, recipeName: string, recipeImage?: string) => {
        if (savedRecipeIds.has(recipeId)) return;

        setSavedRecipeIds(prev => new Set(prev).add(recipeId));

        try {
            await authedFetch('/api/recipes/saved', {
                method: 'POST',
                body: JSON.stringify({ recipeId, recipeName, recipeImage }),
            });
        } catch (error) {
            console.error('Error saving recipe:', error);
        }
    };

    const handleRemoveSavedRecipe = async (recipeId: number) => {
        setSavedRecipeIds(prev => {
            const next = new Set(prev);
            next.delete(recipeId);
            return next;
        });

        try {
            await authedFetch(`/api/recipes/saved?recipeId=${recipeId}`, { method: 'DELETE' });
        } catch (error) {
            console.error('Error removing saved recipe:', error);
        }
    };

    const [isLoadingPantry, setIsLoadingPantry] = useState(false);

    const handleWhatCanIMake = async () => {
        setIsLoadingPantry(true);
        try {
            const response = await authedFetch('/api/pantry');
            if (!response.ok) {
                alert('Failed to fetch pantry items. Please try again.');
                return;
            }
            const data = await response.json();
            const pantryItems: string[] = (data.items || []).map((item: any) => item.canonName);
            if (pantryItems.length === 0) {
                alert('Your pantry is empty. Add items to your pantry first!');
                return;
            }
            const updatedIngredientList = Array.from(new Set([...ingredientList, ...pantryItems]));
            setIngredientList(updatedIngredientList);
            setSearchTerm(updatedIngredientList.join(',').toLowerCase());
        } catch (error) {
            console.error('Error fetching pantry items:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            setIsLoadingPantry(false);
        }
    }

    const activeFilterCount = (selectedDishType !== 'All' ? 1 : 0) + (selectedCuisine !== 'All' ? 1 : 0) + (pantryOnly ? 1 : 0);

    const clearFilters = () => {
        setSelectedDishType('All');
        setSelectedCuisine('All');
        setPantryOnly(false);
    };

    const filteredRecipes = recipes.filter(recipe => !pantryOnly || (recipe.missedIngredientCount ?? 0) === 0);

    const hasSearch = !!(searchTerm || nameQuery);

    return (
        <div className="space-y-4">
            {/* Search bar + action buttons */}
            <div className="flex gap-2 items-start">
                <div className="flex-1">
                    <RecipeAutocomplete
                        value={nameInput}
                        onChange={setNameInput}
                        onSubmit={handleCombinedSearch}
                    />
                </div>

                <Button
                    type="button"
                    onClick={handleCombinedSearch}
                    className="shrink-0 inline-flex items-center gap-2"
                >
                    <Search className="h-4 w-4" />
                    Search
                </Button>

                <Button
                    type="button"
                    onClick={handleWhatCanIMake}
                    className="shrink-0 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md hover:shadow-lg hover:from-orange-600 hover:to-amber-600 transition-all border-0"
                    disabled={isLoadingPantry}
                >
                    {isLoadingPantry ? 'Loading Pantry...' : 'What Can I Make?'}
                </Button>
            </div>

            {/* Ingredients */}
            <DynamicList
                ingredients={ingredientList}
                setIngredients={setIngredientList}
            />

            {/* Filter bar + result count + create */}
            <div className="flex flex-wrap items-center gap-2">
                <Select
                    value={selectedDishType}
                    onValueChange={(value: SetStateAction<string>) => setSelectedDishType(value)}
                >
                    <SelectTrigger className={`h-8 w-auto rounded-full text-xs px-3 ${selectedDishType !== 'All' ? 'border-primary bg-primary/5' : 'border-dashed'}`}>
                        {selectedDishType === 'All'
                            ? <span className="text-muted-foreground">Dish Type</span>
                            : <span>{selectedDishType.charAt(0).toUpperCase() + selectedDishType.slice(1)}</span>
                        }
                    </SelectTrigger>
                    <SelectContent>
                        {dishTypes.map((dishType) => (
                            <SelectItem key={dishType} value={dishType}>
                                {dishType.charAt(0).toUpperCase() + dishType.slice(1)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={selectedCuisine}
                    onValueChange={(value: SetStateAction<string>) => setSelectedCuisine(value)}
                >
                    <SelectTrigger className={`h-8 w-auto rounded-full text-xs px-3 ${selectedCuisine !== 'All' ? 'border-primary bg-primary/5' : 'border-dashed'}`}>
                        {selectedCuisine === 'All'
                            ? <span className="text-muted-foreground">Cuisine</span>
                            : <span>{selectedCuisine}</span>
                        }
                    </SelectTrigger>
                    <SelectContent>
                        {cuisines.map((cuisine) => (
                            <SelectItem key={cuisine} value={cuisine}>
                                {cuisine}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <button
                    type="button"
                    onClick={() => setPantryOnly(!pantryOnly)}
                    className={`h-8 rounded-full text-xs font-medium px-3 transition-colors ${
                        pantryOnly
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-dashed border-input bg-background hover:bg-accent'
                    }`}
                >
                    Pantry Only
                </button>

                {activeFilterCount > 0 && (
                    <>
                        <Badge variant="secondary" className="rounded-full text-xs">
                            {activeFilterCount} active
                        </Badge>
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Clear all
                        </button>
                    </>
                )}

                {/* Spacer pushes right-side items */}
                <div className="flex-1" />

                {hasSearch && !isLoading && filteredRecipes.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                        {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''} found
                    </p>
                )}
            </div>

            {/* Recipe grid / loading / empty states */}
            {isLoading ? (
                <RecipeGridSkeleton />
            ) : filteredRecipes.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredRecipes.map(recipe => (
                        <RecipeCard
                            key={recipe.id}
                            id={recipe.id}
                            title={recipe.title}
                            image={recipe.image}
                            readyInMinutes={recipe.readyInMinutes}
                            servings={recipe.servings}
                            score={recipe.score}
                            subtitle={recipe.usedIngredients?.length ? `${recipe.usedIngredients.length} matching ingredient${recipe.usedIngredients.length !== 1 ? 's' : ''}` : undefined}
                        >
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    savedRecipeIds.has(recipe.id)
                                        ? handleRemoveSavedRecipe(recipe.id)
                                        : handleSaveRecipe(recipe.id, recipe.title, recipe.image);
                                }}
                                className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-colors ${
                                    savedRecipeIds.has(recipe.id)
                                        ? 'bg-red-500/80 text-white'
                                        : 'bg-black/40 text-white hover:bg-black/60'
                                }`}
                            >
                                <Heart className={`h-4 w-4 ${savedRecipeIds.has(recipe.id) ? 'fill-current' : ''}`} />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    collectionDialog.openDialog({ id: recipe.id, title: recipe.title, image: recipe.image });
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
                            >
                                <FolderHeart className="h-4 w-4" />
                            </button>
                        </RecipeCard>
                    ))}
                </div>
            ) : hasSearch ? (
                /* No results */
                <div className="rounded-2xl bg-muted/40 py-16 flex flex-col items-center text-center">
                    <Search className="h-10 w-10 text-muted-foreground/40 mb-4" />
                    <h3 className="text-lg font-semibold mb-1">No recipes found</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        Try different ingredients or adjust your filters
                    </p>
                </div>
            ) : (
                /* No search yet */
                <div className="relative overflow-hidden rounded-2xl py-16 flex flex-col items-center text-center"
                     style={{ background: 'linear-gradient(135deg, hsl(14 80% 52% / 0.10) 0%, hsl(30 90% 55% / 0.08) 50%, hsl(350 70% 60% / 0.05) 100%)' }}>
                    <Search className="h-10 w-10 text-primary/40 mb-4" />
                    <h3 className="text-lg font-semibold mb-1">Discover your next meal</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mb-6">
                        Add ingredients above to find recipe suggestions, or explore what you can cook with your pantry.
                    </p>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={handleWhatCanIMake}
                            disabled={isLoadingPantry}
                        >
                            What Can I Make?
                        </Button>
                        <Link href="/recipes/create">
                            <Button className="rounded-full">
                                <Plus className="h-4 w-4 mr-1" />
                                Create Recipe
                            </Button>
                        </Link>
                    </div>
                </div>
            )}

            <AddToCollectionDialog isOpen={collectionDialog.isOpen} onOpenChange={collectionDialog.setIsOpen} recipe={collectionDialog.recipe} />
        </div>
    );
};

export default Recipes;
