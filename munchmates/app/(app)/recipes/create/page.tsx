'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Clock, Users, Upload, X, Plus, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import Autosuggest from '@/components/ingredients/Autosuggest';
import { authedFetch } from '@/lib/authedFetch';
import { ensureToken, waitForInit } from '@/lib/keycloak';

const dishTypes = ['main course', 'side dish', 'dessert', 'appetizer', 'salad', 'bread', 'breakfast', 'soup', 'beverage', 'sauce', 'marinade', 'fingerfood', 'snack', 'drink'];
const cuisines = ['African', 'Asian', 'American', 'British', 'Cajun', 'Caribbean', 'Chinese', 'Eastern European', 'European', 'French', 'German', 'Greek', 'Indian', 'Irish', 'Italian', 'Japanese', 'Jewish', 'Korean', 'Latin American', 'Mediterranean', 'Mexican', 'Middle Eastern', 'Nordic', 'Southern', 'Spanish', 'Thai', 'Vietnamese'];

const ingredientData = [
    "Apple", "Banana", "Orange", "Lemon", "Lime", "Grapefruit", "Strawberry", "Blueberry",
    "Raspberry", "Blackberry", "Grape", "Watermelon", "Cantaloupe", "Honeydew", "Pineapple",
    "Mango", "Peach", "Nectarine", "Plum", "Pear", "Kiwi", "Pomegranate", "Cherry", "Apricot",
    "Cranberry", "Fig", "Date",
    "Broccoli", "Cauliflower", "Carrot", "Celery", "Cucumber", "Zucchini", "Yellow Squash",
    "Butternut Squash", "Acorn Squash", "Pumpkin", "Sweet Potato", "Russet Potato", "Red Potato",
    "Yukon Gold Potato", "Onion", "Red Onion", "Yellow Onion", "White Onion", "Green Onion",
    "Shallot", "Garlic", "Ginger", "Bell Pepper", "Red Bell Pepper", "Yellow Bell Pepper",
    "Green Bell Pepper", "Orange Bell Pepper", "Jalapeño", "Serrano Pepper", "Habanero Pepper",
    "Poblano Pepper", "Tomato", "Cherry Tomato", "Grape Tomato", "Roma Tomato", "Spinach",
    "Kale", "Romaine Lettuce", "Iceberg Lettuce", "Mixed Greens", "Arugula", "Cabbage",
    "Red Cabbage", "Brussels Sprouts", "Asparagus", "Green Beans", "Snow Peas", "Snap Peas",
    "Mushroom", "Portobello Mushroom", "Cremini Mushroom", "White Mushroom", "Eggplant", "Beet",
    "Radish", "Leek", "Fennel", "Corn",
    "Basil", "Cilantro", "Parsley", "Oregano", "Thyme", "Rosemary", "Sage", "Dill", "Mint",
    "Chives", "Tarragon",
    "Chicken Breast", "Chicken Thigh", "Whole Chicken", "Ground Chicken", "Beef Steak",
    "Ground Beef", "Pork Chop", "Pork Tenderloin", "Ground Pork", "Bacon", "Sausage",
    "Lamb Chop", "Ground Lamb", "Duck Breast", "Ground Turkey", "Turkey Breast",
    "Salmon", "Tuna", "Cod", "Tilapia", "Halibut", "Shrimp", "Crab", "Lobster", "Mussels",
    "Clams", "Oysters", "Squid", "Scallops", "Anchovies",
    "Milk", "Whole Milk", "Skim Milk", "Butter", "Cream", "Heavy Cream", "Sour Cream",
    "Whipped Cream", "Cheese", "Cheddar Cheese", "Mozzarella Cheese", "Parmesan Cheese",
    "Swiss Cheese", "Feta Cheese", "Cream Cheese", "Gouda Cheese", "Brie", "Eggs", "Yogurt",
    "Greek Yogurt",
    "Rice", "White Rice", "Brown Rice", "Basmati Rice", "Jasmine Rice", "Arborio Rice",
    "Wild Rice", "Quinoa", "Couscous", "Oats", "Oatmeal", "Barley", "Wheat Berries",
    "Salt", "Sea Salt", "Kosher Salt", "Black Pepper", "Olive Oil", "Vegetable Oil",
    "Soy Sauce", "Vinegar", "Flour", "Sugar", "Honey",
];

export default function CreateRecipePage() {
    const router = useRouter();

    const [title, setTitle] = useState('');
    const [readyInMinutes, setReadyInMinutes] = useState(30);
    const [servings, setServings] = useState(1);
    const [dishType, setDishType] = useState('main course');
    const [cuisine, setCuisine] = useState('American');
    const [ingredients, setIngredients] = useState<string[]>([]);
    const [newIngredient, setNewIngredient] = useState('');
    const [steps, setSteps] = useState<string[]>(['']);
    const [summary, setSummary] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleAddIngredient = () => {
        const trimmed = newIngredient.trim();
        if (trimmed && !ingredients.includes(trimmed)) {
            setIngredients(prev => [...prev, trimmed]);
            setNewIngredient('');
            setErrors(prev => { const { ingredients: _, ...rest } = prev; return rest; });
        }
    };

    const handleRemoveIngredient = (index: number) => {
        setIngredients(prev => prev.filter((_, i) => i !== index));
    };

    const handleStepChange = (index: number, value: string) => {
        setSteps(prev => prev.map((s, i) => (i === index ? value : s)));
    };

    const handleAddStep = () => {
        setSteps(prev => [...prev, '']);
    };

    const handleRemoveStep = (index: number) => {
        setSteps(prev => prev.filter((_, i) => i !== index));
    };

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!title.trim()) errs.title = 'Recipe title is required';
        if (ingredients.length === 0) errs.ingredients = 'At least one ingredient is required';
        const nonEmptySteps = steps.filter(s => s.trim());
        if (nonEmptySteps.length === 0) errs.steps = 'At least one instruction step is required';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        setIsSubmitting(true);
        try {
            let imageUrl: string | undefined;

            // Upload image if selected (use raw fetch — authedFetch forces Content-Type: application/json)
            if (imageFile) {
                await waitForInit();
                const token = await ensureToken();
                const formData = new FormData();
                formData.append('file', imageFile);
                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                });
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    imageUrl = uploadData.url;
                }
            }

            // Join non-empty steps with newlines
            const instructionsText = steps.filter(s => s.trim()).map((s, i) => `${i + 1}. ${s.trim()}`).join('\n');

            const response = await authedFetch('/api/recipes/create', {
                method: 'POST',
                body: JSON.stringify({
                    title: title.trim(),
                    servings,
                    readyInMinutes,
                    dishTypes: [dishType],
                    cuisines: [cuisine],
                    ingredients,
                    instructions: instructionsText,
                    image: imageUrl,
                    summary: summary.trim() || undefined,
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.error?.message || 'Failed to create recipe');
            }

            const data = await response.json();
            if (data.id) {
                router.push(`/recipes/${data.id}`);
            }
        } catch (error: any) {
            console.error('Error creating recipe:', error);
            alert(error.message || 'Failed to create recipe. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-full bg-background">
            {/* Header Section */}
            <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-8">
                {/* Back button */}
                <Link
                    href="/recipes/my-recipes"
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors mb-4"
                >
                    <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                </Link>

                <div className="flex flex-col md:flex-row gap-6 md:gap-8 md:items-stretch">
                    {/* Left — Info card */}
                    <div className="flex-1 min-w-0 rounded-2xl border bg-muted/40 p-6 sm:p-8 flex flex-col justify-center">
                        {/* Title input */}
                        <input
                            type="text"
                            placeholder="Recipe Title"
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                if (errors.title) setErrors(prev => { const { title: _, ...rest } = prev; return rest; });
                            }}
                            className={`text-2xl sm:text-3xl font-bold tracking-tight bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/40 mb-4 ${errors.title ? 'placeholder:text-destructive/60' : ''}`}
                        />
                        {errors.title && <p className="text-sm text-destructive -mt-3 mb-3">{errors.title}</p>}

                        {/* Stat inputs row */}
                        <div className="flex items-center gap-4 mb-5 text-sm">
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4 text-primary" />
                                <Input
                                    type="number"
                                    min={1}
                                    value={readyInMinutes}
                                    onChange={(e) => setReadyInMinutes(parseInt(e.target.value) || 30)}
                                    className="w-16 h-7 text-center text-sm font-semibold px-1"
                                />
                                <span className="text-muted-foreground">min</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Users className="h-4 w-4 text-primary" />
                                <Input
                                    type="number"
                                    min={1}
                                    value={servings}
                                    onChange={(e) => setServings(parseInt(e.target.value) || 1)}
                                    className="w-16 h-7 text-center text-sm font-semibold px-1"
                                />
                                <span className="text-muted-foreground">servings</span>
                            </div>
                        </div>

                        {/* Dish type + cuisine pills */}
                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={dishType} onValueChange={setDishType}>
                                <SelectTrigger className="h-8 w-auto rounded-full text-xs px-3 border bg-background/60 text-muted-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {dishTypes.map(type => (
                                        <SelectItem key={type} value={type}>
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={cuisine} onValueChange={setCuisine}>
                                <SelectTrigger className="h-8 w-auto rounded-full text-xs px-3 border bg-background/60 text-muted-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {cuisines.map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-3 mt-6">
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="rounded-full"
                            >
                                {isSubmitting ? 'Saving...' : 'Save Recipe'}
                            </Button>
                            <Button
                                variant="outline"
                                className="rounded-full"
                                onClick={() => router.push('/recipes/my-recipes')}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>

                    {/* Right — Image upload zone */}
                    <div className="w-full md:w-80 lg:w-96 flex-shrink-0">
                        <label className="relative flex h-full min-h-[240px] rounded-2xl overflow-hidden border bg-muted shadow-sm cursor-pointer group">
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={handleImageChange}
                                className="sr-only"
                            />
                            {imagePreview ? (
                                <>
                                    <Image
                                        src={imagePreview}
                                        alt="Recipe preview"
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 100vw, 384px"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                        <Upload className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col h-full w-full items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 group-hover:from-orange-100 group-hover:to-amber-100 dark:group-hover:from-orange-950/80 dark:group-hover:to-amber-950/80 transition-colors">
                                    <Upload className="h-10 w-10 text-muted-foreground/40 mb-2" />
                                    <span className="text-sm text-muted-foreground">Click to upload image</span>
                                </div>
                            )}
                        </label>
                    </div>
                </div>
            </div>

            {/* Two-Column Layout */}
            <div className="px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                <div className="flex flex-col-reverse md:flex-row md:gap-8 gap-6">
                    {/* Left Column — Instructions */}
                    <div className="md:w-[60%]">
                        <div className="rounded-2xl border bg-muted/40 p-6 sm:p-8">
                            <h2 className="text-xl font-semibold mb-6">Instructions</h2>
                            {errors.steps && <p className="text-sm text-destructive -mt-3 mb-4">{errors.steps}</p>}

                            <ol className="space-y-4">
                                {steps.map((step, index) => (
                                    <li key={index} className="flex gap-4">
                                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 pt-0.5">
                                            <textarea
                                                value={step}
                                                onChange={(e) => handleStepChange(index, e.target.value)}
                                                placeholder="Describe this step..."
                                                rows={2}
                                                className="w-full rounded-xl border bg-background px-4 py-3 text-[15px] leading-7 resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-muted-foreground/40"
                                            />
                                        </div>
                                        {steps.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveStep(index)}
                                                className="flex-shrink-0 w-8 h-8 mt-1 flex items-center justify-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ol>

                            <button
                                type="button"
                                onClick={handleAddStep}
                                className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-muted-foreground/20 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                Add Step
                            </button>
                        </div>
                    </div>

                    {/* Right Column — Ingredients (sticky) */}
                    <div className="md:w-[40%]">
                        <div className="md:sticky md:top-6 rounded-2xl border bg-muted/40 p-6 sm:p-8">
                            <h2 className="text-xl font-semibold mb-4">Ingredients</h2>
                            {errors.ingredients && <p className="text-sm text-destructive -mt-2 mb-3">{errors.ingredients}</p>}

                            {/* Ingredient list */}
                            {ingredients.length > 0 && (
                                <div className="space-y-1 mb-4">
                                    {ingredients.map((ingredient, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-background/60 transition-colors"
                                        >
                                            <span className="flex-1 text-sm text-foreground">{ingredient}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveIngredient(index)}
                                                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add ingredient */}
                            <div className="space-y-2">
                                <Autosuggest
                                    data={[...ingredientData, ...ingredients]}
                                    query={newIngredient}
                                    setQuery={setNewIngredient}
                                    onSelect={(item) => {
                                        if (item.trim() && !ingredients.includes(item.trim())) {
                                            setIngredients(prev => [...prev, item.trim()]);
                                            setErrors(prev => { const { ingredients: _, ...rest } = prev; return rest; });
                                        }
                                        setNewIngredient('');
                                    }}
                                />
                                <Button
                                    type="button"
                                    onClick={handleAddIngredient}
                                    variant="outline"
                                    className="w-full"
                                    disabled={!newIngredient.trim()}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Ingredient
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Section — Full Width */}
            <div className="border-t bg-muted/40">
                <div className="px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        About this recipe
                    </h2>
                    <textarea
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder="Add a description or notes about your recipe..."
                        rows={4}
                        className="w-full rounded-xl border bg-background px-4 py-3 text-muted-foreground leading-7 resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-muted-foreground/40"
                    />
                </div>
            </div>
        </div>
    );
}
