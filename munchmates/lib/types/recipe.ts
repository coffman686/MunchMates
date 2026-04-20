export type SavedRecipe = {
    recipeId: number;
    recipeName: string;
    recipeImage?: string;
    savedAt: string;
};

export type RecipeSearchResult = {
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
};

export type PopularRecipe = {
    id: number;
    title: string;
    image?: string;
    readyInMinutes?: number;
    servings?: number;
};
