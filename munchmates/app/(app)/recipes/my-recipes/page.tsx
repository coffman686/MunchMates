'use client';

import { useState, useEffect } from 'react';
import AppHeader from '@/components/layout/app-header';
import RequireAuth from '@/components/RequireAuth';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/app-sidebar';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    ChefHat,
    ArrowLeft,
    Trash2,
    Clock,
    Users,
    Plus,
} from 'lucide-react';
import { authedFetch } from '@/lib/authedFetch';

type CustomRecipe = {
    id: number;
    title: string;
    image?: string;
    servings: number;
    readyInMinutes: number;
    dishTypes: string[];
    cuisines: string[];
};

const MyRecipesPage = () => {
    const router = useRouter();
    const [recipes, setRecipes] = useState<CustomRecipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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
                    setRecipes(
                        (data.recipes || []).map((r: any) => ({
                            id: r.id,
                            title: r.title,
                            image: r.image || undefined,
                            servings: r.servings,
                            readyInMinutes: r.readyInMinutes,
                            dishTypes: r.dishTypes || [],
                            cuisines: r.cuisines || [],
                        }))
                    );
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
        setRecipes(prev => prev.filter(r => r.id !== recipeId));
        try {
            await authedFetch(`/api/recipes/create?id=${recipeId}`, { method: 'DELETE' });
        } catch (error) {
            console.error('Error deleting recipe:', error);
        }
    };

    return (
        <RequireAuth>
            <SidebarProvider>
                <div className="min-h-screen flex w-full">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col">
                        <AppHeader title="My Recipes" />
                        <main className="flex-1 p-6">
                            <div className="max-w-6xl mx-auto">
                                {/* Header */}
                                <div className="mb-8">
                                    <Button
                                        variant="ghost"
                                        onClick={() => router.push('/recipes')}
                                        className="mb-4"
                                    >
                                        <ArrowLeft className="h-4 w-4 mr-2" />
                                        Back to Recipes
                                    </Button>
                                    <h1 className="text-3xl font-bold flex items-center gap-3">
                                        <ChefHat className="h-8 w-8" />
                                        My Recipes
                                    </h1>
                                    <p className="text-muted-foreground mt-2">
                                        Recipes you&apos;ve created
                                    </p>
                                </div>

                                {/* Content */}
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <ChefHat className="h-12 w-12 text-muted-foreground animate-spin" />
                                    </div>
                                ) : recipes.length === 0 ? (
                                    <Card className="text-center py-12">
                                        <CardContent>
                                            <ChefHat className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                            <h3 className="text-xl font-semibold mb-2">
                                                No custom recipes yet
                                            </h3>
                                            <p className="text-muted-foreground mb-6">
                                                Create your own recipes and they&apos;ll show up here!
                                            </p>
                                            <Button onClick={() => router.push('/recipes')}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Create Recipe
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {recipes.map((recipe) => (
                                            <Card
                                                key={recipe.id}
                                                className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow duration-300"
                                            >
                                                <div className="h-48 bg-gradient-to-br from-primary/20 to-muted flex items-center justify-center">
                                                    {recipe.image ? (
                                                        <img
                                                            src={recipe.image}
                                                            alt={recipe.title}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <ChefHat className="h-16 w-16 text-muted-foreground/50" />
                                                    )}
                                                </div>
                                                <CardHeader className="pb-3 flex-1">
                                                    <CardTitle className="text-lg leading-tight">
                                                        {recipe.title}
                                                    </CardTitle>
                                                    <CardDescription className="line-clamp-2">
                                                        {recipe.dishTypes.map(dishType => (
                                                            <Badge key={dishType} className="mr-1">
                                                                {dishType.charAt(0).toUpperCase() + dishType.slice(1)}
                                                            </Badge>
                                                        ))}
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent className="pb-3">
                                                    <div className="flex flex-wrap gap-2 mb-3">
                                                        {recipe.cuisines.map(cuisine => (
                                                            <Badge key={cuisine} variant="secondary">
                                                                {cuisine}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="h-4 w-4" />
                                                            <span>{recipe.readyInMinutes} min</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Users className="h-4 w-4" />
                                                            <span>{recipe.servings} servings</span>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                                <CardFooter className="flex gap-2">
                                                    <Button
                                                        onClick={() => router.push(`/recipes/${recipe.id}`)}
                                                        className="flex-1"
                                                    >
                                                        View Recipe
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => handleDelete(recipe.id)}
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </CardFooter>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </main>
                    </div>
                </div>
            </SidebarProvider>
        </RequireAuth>
    );
};

export default MyRecipesPage;
