// Dashboard Page
// Renders the main MunchMates home experience after login, giving users a
// high-level snapshot of their cooking, planning, and pantry activity.
// Includes:
// - Personalized greeting from Keycloak ID/Access token claims
// - "Tip of the day" motivation, rotated deterministically by date
// - Today’s meal plan (breakfast / lunch / dinner) with quick links to recipes
// - Quick action cards for Recipes, Meal Planner, Grocery List, Pantry,
//   Shared Collections, and Community
// - Pantry alerts for items expiring soon (API-backed via /api/pantry)
// - Grocery list summary with active item count (API-backed via /api/grocery)
// - Saved recipes preview (API-backed via /api/recipes/saved)
// - Popular recipes carousel from Spoonacular
// - Weekly stats for meals planned and pantry alerts
// Behavior:
// - Fetches all data from authenticated API endpoints
// - Initializes a dietary preferences dialog on first visit via local flag
// - Designed as the central hub tying together all major app features.

'use client';

import {
    AlertTriangle,
    ArrowRight,
    Check,
    Coffee,Droplets,Drumstick, Flame,
    FolderHeart,
    Heart,
    type LucideIcon,
    Moon,
    RefreshCw,
    ShoppingCart,
    Utensils, Wheat,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DietaryDialog } from '@/components/ingredients/Dietary';
import AppSidebar from '@/components/layout/app-sidebar';
import RequireAuth from '@/components/RequireAuth';
import AddToCollectionDialog, { useAddToCollection } from '@/components/recipes/AddToCollectionDialog';
import RecipeCard from '@/components/recipes/RecipeCard';
import { Button } from '@/components/ui/button';
import { SidebarProvider } from '@/components/ui/sidebar';
import { authedFetch } from '@/lib/authedFetch';
import { ensureToken, getAccessTokenClaims, getParsedIdToken, keycloak } from '@/lib/keycloak';
import type { NutritionDaySummary, NutritionMetricProgress } from '@/lib/types/meal-plan';

// initialize types
type IdClaims = { name?: string; preferred_username?: string; email?: string };
type AccessClaims = { preferred_username?: string; email?: string; realm_access?: { roles?: string[] } };

// define interfaces for data structures
interface MealPlanEntry {
    id: string;
    recipeId: number;
    title: string;
    image?: string;
    servings: number;
    originalServings: number;
}

// Meal plan for single day
interface DayPlan {
    date: string;
    breakfast?: MealPlanEntry;
    lunch?: MealPlanEntry;
    dinner?: MealPlanEntry;
}

// Meal plan for entire week
interface WeeklyMealPlan {
    weekStart: string;
    days: DayPlan[];
}

// Pantry items
interface PantryItem {
    id: number;
    name: string;
    quantity: string;
    category: string;
    expiryDate?: string | null;
    addedAt: string;
}

// Grocery list items
interface GroceryItem {
    id: number;
    name: string;
    category: string;
    completed: boolean;
    quantity?: string;
    fromMealPlan?: boolean;
}

// Popular recipes from Spoonacular
interface PopularRecipe {
    id: number;
    title: string;
    image?: string;
    readyInMinutes?: number;
    servings?: number;
}

interface NutritionProgressDial {
  label: string,
  unit: string,
  icon: LucideIcon,
  color: string,
  data: NutritionMetricProgress | null
}

// helper function to get Monday of the week for a given date
function getWeekMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

// helper function to get local date string in YYYY-MM-DD format
function formatLocalDateStr(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTodayStr(): string {
  return formatLocalDateStr(new Date());
}

function getCurrentWeekStartStr(): string {
  const today = new Date();
  const weekMonday = getWeekMonday(today);
  return formatLocalDateStr(weekMonday);
}

// helper function to get greeting based on time of day
function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

// helper function to calculate days until expiry
function getDaysUntilExpiry(expiryDate: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// helper function to format date nicely
function formatDate(date: Date): string {
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

// daily-rotating offset for popular recipes (changes each day)
function getDailyOffset(): number {
    const todayStr = formatLocalDateStr(new Date());
    const saved = localStorage.getItem('popularRecipeOffset');
    if (saved) {
        try {
            const { date, offset } = JSON.parse(saved);
            if (date === todayStr) return offset;
        } catch { /* ignore bad data */ }
    }
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    return (dayOfYear * 8) % 200;
}

// Helper to make data for the progress dials
const makeNutritionDials = (data: NutritionDaySummary | null): NutritionProgressDial[] => {
  return [
    {
      label: "Calories",
      unit: "kcal",
      icon: Flame,
      color: "#FF9F0A",
      data: data?.progress.calories ?? null,
    },
    {
      label: "Protein",
      unit: "g",
      icon: Drumstick,
      color: "#30D158",
      data: data?.progress.protein ?? null,
    },
    {
      label: "Carbs",
      unit: "g",
      icon: Wheat,
      color: "#5E5CE6",
      data: data?.progress.carbs ?? null,
    },
    {
      label: "Fat",
      unit: "g",
      icon: Droplets,
      color: "#AE38AE",
      data: data?.progress.fat ?? null,
    },
  ]
}



// generic motivational tips for dashboard
const cookingTips = [
    "Try adding a splash of acid (lemon juice or vinegar) to brighten up any dish!",
    "Prep your ingredients before you start cooking, it makes everything smoother.",
    "Don't be afraid to experiment with spices. Start small and taste as you go!",
    "Fresh herbs can transform a simple dish into something special.",
    "Let your meat rest after cooking for juicier results.",
    "Taste your food as you cook, seasoning adjustments make all the difference.",
    "A sharp knife is a safe knife. Keep your blades honed!",
    "Room temperature ingredients blend better in baking.",
];

// main dashboard component
// displays user info, today's meal plan, pantry alerts, grocery list, saved recipes, and shared collections
// allows setting dietary preferences on first visit
// uses various hooks to load data and manage state
// provides quick access to key features via cards
export default function Dashboard() {
    const [name, setName] = useState('');
    const [todayPlan, setTodayPlan] = useState<DayPlan | null>(null);
    const [pantryAlerts, setPantryAlerts] = useState<PantryItem[]>([]);
    const [groceryCount, setGroceryCount] = useState(0);
    const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
    const [weeklyStats, setWeeklyStats] = useState({ mealsPlanned: 0 });
    const [tipOfDay, setTipOfDay] = useState('');
    const [popularRecipes, setPopularRecipes] = useState<PopularRecipe[]>([]);
    const [popularLoading, setPopularLoading] = useState(false);

    // saved / favorite recipes
    const [savedRecipeIds, setSavedRecipeIds] = useState<Set<number>>(new Set());

    // dietary preferences modal state
    const [dietModal, setDietModal] = useState(false);
    const [diets, setDiets] = useState<string[]>([]);
    const [intolerances, setIntolerances] = useState<string[]>([]);

    // nutrition widget
    const [nutritionProgress, setNutritionProgress] = useState<NutritionProgressDial[]>(makeNutritionDials(null));

    // Open dietary preferences modal if uninitialized
    useEffect(() => {
        const localDietsInit = localStorage.getItem("hasDietsInit");
        if (localDietsInit !== "true") {
            setDietModal(true);
        }
    }, []);

    // Close preferences modal and complete initialization
    function closeDiet(e: React.SyntheticEvent) {
        e.preventDefault();
        localStorage.setItem("hasDietsInit", "true");
        setDietModal(false);
    }

    // set tip of the day based on day of year
    useEffect(() => {
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        setTipOfDay(cookingTips[dayOfYear % cookingTips.length]);
    }, []);

    // load user info from Keycloak
    // set up listeners for auth events to refresh info
    useEffect(() => {
        let mounted = true;

        const readClaims = () => {
            const id = (getParsedIdToken<IdClaims>() ?? {}) as IdClaims;
            const acc = (getAccessTokenClaims<AccessClaims>() ?? {}) as AccessClaims;
            setName(id.name || id.preferred_username || acc.preferred_username || '');
        };

        (async () => {
            await ensureToken();
            if (!mounted) return;
            readClaims();
        })();

        keycloak.onAuthSuccess = async () => {
            if (!mounted) return;
            await ensureToken();
            readClaims();
        };
        keycloak.onAuthRefreshSuccess = async () => {
            if (!mounted) return;
            await ensureToken();
            readClaims();
        };

        return () => {
            mounted = false;
            keycloak.onAuthSuccess = undefined;
            keycloak.onAuthRefreshSuccess = undefined;
        };
    }, []);

    // load today's meal plan
    // tries API first, falls back to localStorage
    // also calculates weekly stats
    useEffect(() => {
        const loadMealPlan = async () => {
            const today = new Date();
            const weekMonday = getWeekMonday(today);
            const weekStart = formatLocalDateStr(weekMonday);
            const todayStr = formatLocalDateStr(today);

            try {
                // try API fetch
                const res = await authedFetch(`/api/meal-plan?weekStart=${weekStart}`);
                if (res.ok) {
                    const data: WeeklyMealPlan = await res.json();
                    const todayMeals = data.days.find(d => d.date === todayStr);
                    setTodayPlan(todayMeals || null);

                    // calculate weekly stats
                    let mealsCount = 0;
                    data.days.forEach(day => {
                        if (day.breakfast) mealsCount++;
                        if (day.lunch) mealsCount++;
                        if (day.dinner) mealsCount++;
                    });
                    setWeeklyStats(prev => ({ ...prev, mealsPlanned: mealsCount }));
                    return;
                }
            } catch {
                // fall back to localStorage
            }

            // localStorage fallback
            const stored = localStorage.getItem(`mealPlan-${weekStart}`);
            if (stored) {
                const data: WeeklyMealPlan = JSON.parse(stored);
                const todayMeals = data.days.find(d => d.date === todayStr);
                setTodayPlan(todayMeals || null);

                let mealsCount = 0;
                data.days.forEach(day => {
                    if (day.breakfast) mealsCount++;
                    if (day.lunch) mealsCount++;
                    if (day.dinner) mealsCount++;
                });
                setWeeklyStats(prev => ({ ...prev, mealsPlanned: mealsCount }));
            }
        };

        loadMealPlan();
    }, []);

    // load pantry alerts for items expiring within 7 days (from API)
    useEffect(() => {
        const loadPantryAlerts = async () => {
            try {
                const res = await authedFetch('/api/pantry');
                if (res.ok) {
                    const data = await res.json();
                    const items: PantryItem[] = data.items || [];
                    const expiring = items.filter(item => {
                        if (!item.expiryDate) return false;
                        const days = getDaysUntilExpiry(item.expiryDate);
                        return days <= 7 && days >= 0;
                    }).sort((a, b) => getDaysUntilExpiry(a.expiryDate!) - getDaysUntilExpiry(b.expiryDate!));
                    setPantryAlerts(expiring.slice(0, 5));
                }
            } catch {
                // silently fail
            }
        };
        loadPantryAlerts();
    }, []);

    // load grocery list items (from API)
    useEffect(() => {
        const loadGrocery = async () => {
            try {
                const res = await authedFetch('/api/grocery');
                if (res.ok) {
                    const data = await res.json();
                    const items: GroceryItem[] = data.items || [];
                    setGroceryItems(items.filter(i => !i.completed).slice(0, 8));
                    setGroceryCount(items.filter(i => !i.completed).length);
                }
            } catch {
                // silently fail
            }
        };
        loadGrocery();
    }, []);

    // load saved recipe IDs from API
    useEffect(() => {
        let cancelled = false;
        const loadSaved = async () => {
            try {
                const res = await authedFetch('/api/recipes/saved');
                if (cancelled) return;
                if (res.ok) {
                    const data = await res.json();
                    const ids = (data.recipes || []).map((r: { recipeId: number }) => r.recipeId);
                    setSavedRecipeIds(new Set(ids));
                }
            } catch { /* silently fail */ }
        };
        loadSaved();
        return () => { cancelled = true; };
    }, []);


    useEffect(() => {
      const loadNutrition = async () => {
        const res = await authedFetch(`/api/meal-plan/nutrition-summary?weekStart=${getCurrentWeekStartStr()}`);
        const empty = () => makeNutritionDials(null);

        if (!res.ok) {
          setNutritionProgress(empty());
          return;
        }

        const nutritionData = await res.json();
        const days: NutritionDaySummary[] = nutritionData.days ?? [];
        const todayStr = formatTodayStr();
        const today: NutritionDaySummary = days.find((day) => day.date === todayStr) ?? days[0] ?? null;

        if (!today) {
          setNutritionProgress(empty());
          return;
        }

        setNutritionProgress(makeNutritionDials(today));
      }
      loadNutrition();
    }, []);

    // toggle save/unsave a recipe
    const toggleSaveRecipe = async (recipeId: number, title: string, image?: string) => {
        const isSaved = savedRecipeIds.has(recipeId);
        setSavedRecipeIds(prev => {
            const next = new Set(prev);
            if (isSaved) next.delete(recipeId); else next.add(recipeId);
            return next;
        });
        try {
            if (isSaved) {
                await authedFetch(`/api/recipes/saved?recipeId=${recipeId}`, { method: 'DELETE' });
            } else {
                await authedFetch('/api/recipes/saved', {
                    method: 'POST',
                    body: JSON.stringify({ recipeId, recipeName: title, recipeImage: image }),
                });
            }
        } catch { /* silently fail */ }
    };

    const collectionDialog = useAddToCollection();

    // fetch popular recipes from Spoonacular
    const fetchPopularRecipes = useCallback(async (offset?: number) => {
        setPopularLoading(true);
        try {
            const o = offset ?? getDailyOffset();
            localStorage.setItem('popularRecipeOffset', JSON.stringify({
                date: formatLocalDateStr(new Date()),
                offset: o,
            }));
            const res = await fetch(`/api/spoonacular/recipes/popular?offset=${o}`);
            if (res.ok) {
                const data = await res.json();
                setPopularRecipes((data.recipes || []).slice(0, 8));
            }
        } catch {
            // silently fail
        } finally {
            setPopularLoading(false);
        }
    }, []);

    // load popular recipes on mount
    useEffect(() => {
        fetchPopularRecipes();
    }, [fetchPopularRecipes]);

    const mealSlots: { key: 'breakfast' | 'lunch' | 'dinner'; label: string; icon: typeof Coffee; color: string; bg: string }[] = [
        { key: 'breakfast', label: 'Breakfast', icon: Coffee, color: '#FF9F0A', bg: 'rgba(255,159,10,0.12)' },
        { key: 'lunch', label: 'Lunch', icon: Utensils, color: '#30D158', bg: 'rgba(48,209,88,0.12)' },
        { key: 'dinner', label: 'Dinner', icon: Moon, color: '#5E5CE6', bg: 'rgba(94,92,230,0.12)' },
    ];

    const hasMeals = todayPlan && (todayPlan.breakfast || todayPlan.lunch || todayPlan.dinner);

    // Shared card style — Apple: no border, soft shadow, big radius
    const card = 'rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]';
    return (
        <RequireAuth>
            <SidebarProvider defaultOpen={false}>
                <div className="min-h-screen flex w-full">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col">
                        <main className="flex-1 p-6 bg-muted/20">
                            <div className="w-full space-y-5">

                            {/* ── Hero + Stats ── */}
                            <div className="relative overflow-hidden rounded-2xl px-6 pt-5 pb-4"
                                 style={{ background: 'linear-gradient(135deg, hsl(14 80% 52% / 0.18) 0%, hsl(30 90% 55% / 0.12) 50%, hsl(350 70% 60% / 0.08) 100%)' }}>
                                <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full"
                                     style={{ background: 'radial-gradient(circle, hsl(14 70% 55% / 0.15), transparent 65%)' }} />
                                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-4 mb-0.5">
                                            <h1 className="text-2xl font-bold tracking-tight leading-tight truncate">
                                                {getGreeting()}, {name || 'Chef'}!
                                            </h1>
                                            <span className="text-[12px] font-medium text-primary/70 shrink-0 hidden sm:block">{formatDate(new Date())}</span>
                                        </div>
                                        <p className="text-[14px] text-muted-foreground truncate">
                                            {tipOfDay}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2.5 shrink-0">
                                        {[
                                            { label: 'pantry alerts', value: pantryAlerts.length, color: '#FF453A', href: '/pantry' },
                                            { label: `of 21 meals`, value: weeklyStats.mealsPlanned, color: '#30D158', href: '/meal-planner' },
                                            { label: 'grocery items', value: groceryCount, color: '#0A84FF', href: '/grocery-list' },
                                        ].map((stat) => (
                                            <Link key={stat.label} href={stat.href}
                                                  className="flex items-center gap-1.5 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-sm px-3 py-1 hover:bg-white/80 dark:hover:bg-white/20 transition-colors">
                                                <span className="text-[13px] font-bold" style={{ color: stat.color }}>{stat.value}</span>
                                                <span className="text-[12px] text-foreground/60">{stat.label}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* ── Today's Meals ── */}
                            <div className={`${card} p-1.5 grid grid-cols-1 lg:grid-cols-2`}>
                                <div className="grid grid-cols-1 divide-y md:divide-y-0 md:divide-x divide-border/50">
                                    {mealSlots.map(({ key, label, icon: Icon, color, bg }) => {
                                        const meal = hasMeals ? todayPlan?.[key] : undefined;
                                        const content = (
                                            <div className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl ${meal ? 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05] cursor-pointer' : ''} transition-colors`}>
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: bg }}>
                                                    <Icon className="h-[18px] w-[18px]" style={{ color }} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
                                                    {meal ? (
                                                        <p className="font-semibold text-[14px] truncate leading-snug mt-0.5">{meal.title}</p>
                                                    ) : (
                                                        <p className="text-[14px] text-muted-foreground/70 mt-0.5">Not planned</p>
                                                    )}
                                                </div>
                                                {meal && <ArrowRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />}
                                            </div>
                                        );
                                        return meal ? (
                                            <Link key={key} href={`/recipes/${meal.recipeId}`} className="block">{content}</Link>
                                        ) : (
                                            <div key={key}>{content}</div>
                                        );
                                    })}
                                </div>


                                {/* -- nutrition dials -- */}
                                <div className="p-6">
                                  <h2 className="text-center text-xl font-bold mb-2">
                                    Nutrition Summary
                                  </h2>
                                  <div className="flex flex-row justify-center gap-4">
                                    {nutritionProgress.map((dial: NutritionProgressDial) => {
                                        const current = dial.data?.current ?? 0;
                                        const target = dial.data?.target;
                                        const color = dial.color;
                                        const Icon = dial.icon;

                                        const percent = Math.min(dial.data?.percent ?? 0.0, 100.0);
                                        const dialRadius = 40;
                                        const dialCircum = 2 * Math.PI * dialRadius;
                                        const dialCircumPercent = dialCircum - (percent / 100) * dialCircum;
                                        const strokeWidth = dial.data?.status === "over" ? 6 : 4

                                        return (
                                          <div key={dial.label} className="flex flex-col items-center transition-all duration-300ms">
                                            <div className="relative opacity-100">
                                              <svg className="w-25 h-25 -rotate-90">
                                                <title>{dial.label} Dial</title>
                                                <circle
                                                  cx="50" cy="50" r={dialRadius}
                                                  strokeWidth={strokeWidth}
                                                  stroke="currentColor"
                                                  className="text-muted-foreground/10"
                                                  fill="transparent"
                                                />
                                                <circle
                                                  cx="50" cy="50" r={dialRadius}
                                                  strokeWidth={strokeWidth}
                                                  stroke={color}
                                                  strokeLinecap="round"
                                                  fill="transparent"
                                                  strokeDasharray={dialCircum}
                                                  strokeDashoffset={dialCircumPercent}
                                                  className="transition-[stroke-dashoffset] duration-1s"
                                                />
                                              </svg>

                                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <Icon className="mb-1" style={{ color: dial.color }} />
                                                <span className="font-bold">{percent}%</span>
                                              </div>
                                            </div>

                                            <div className="text-center">
                                              <p className="font-bold">{dial.label}</p>
                                              <p className="text-xs text-muted-foreground">{current} {target ? `/ ${target}` : "" } {dial.unit}</p>
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              </div>

                            {/* ── Popular Recipes ── */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-xl font-bold tracking-tight">Popular Recipes</h2>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => fetchPopularRecipes(Math.floor(Math.random() * 200))}
                                            disabled={popularLoading}
                                            className="text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 disabled:opacity-40"
                                        >
                                            <RefreshCw className={`h-3.5 w-3.5 ${popularLoading ? 'animate-spin' : ''}`} />
                                            Refresh
                                        </button>
                                        <Link href="/recipes" className="text-[13px] font-semibold text-primary hover:text-primary/70 transition-colors flex items-center gap-0.5">
                                            Browse All <ArrowRight className="h-3.5 w-3.5" />
                                        </Link>
                                    </div>
                                </div>
                                {popularRecipes.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {popularRecipes.slice(0, 4).map((recipe) => (
                                            <RecipeCard
                                                key={recipe.id}
                                                id={recipe.id}
                                                title={recipe.title}
                                                image={recipe.image}
                                                readyInMinutes={recipe.readyInMinutes}
                                                servings={recipe.servings}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSaveRecipe(recipe.id, recipe.title, recipe.image); }}
                                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
                                                >
                                                    <Heart className={`h-3.5 w-3.5 ${savedRecipeIds.has(recipe.id) ? 'fill-red-500 text-red-500' : 'text-white/90'}`} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); collectionDialog.openDialog({ id: recipe.id, title: recipe.title, image: recipe.image }); }}
                                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm hover:bg-black/60 transition-colors"
                                                >
                                                    <FolderHeart className="h-3.5 w-3.5" />
                                                </button>
                                            </RecipeCard>
                                        ))}
                                    </div>
                                ) : popularLoading ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {Array.from({ length: 4 }).map((_, i) => (
                                            <div key={i} className="aspect-[4/3] rounded-2xl bg-muted animate-pulse" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className={`${card} py-14 flex flex-col items-center text-center`}>
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full mb-4" style={{ backgroundColor: 'rgba(255,159,10,0.1)' }}>
                                            <Utensils className="h-7 w-7" style={{ color: '#FF9F0A' }} />
                                        </div>
                                        <h3 className="text-[16px] font-semibold mb-1">Couldn&apos;t load recipes</h3>
                                        <p className="text-[13px] text-muted-foreground max-w-[280px] mb-5 leading-relaxed">
                                            Try refreshing or browse recipes directly.
                                        </p>
                                        <Button className="rounded-full px-7 h-11 text-[14px] font-semibold shadow-[0_2px_12px_rgba(0,0,0,0.12)]" asChild>
                                            <Link href="/recipes">Browse Recipes</Link>
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* ── Pantry Alerts + Grocery List ── */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Pantry Alerts */}
                                <div className={card}>
                                    <div className="flex items-center justify-between px-5 pt-4 pb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(255,69,58,0.1)' }}>
                                                <AlertTriangle className="h-4 w-4" style={{ color: '#FF453A' }} />
                                            </div>
                                            <h3 className="text-[15px] font-semibold">Expiring Soon</h3>
                                        </div>
                                        <Link href="/pantry" className="text-[12px] font-semibold text-primary hover:text-primary/70 transition-colors flex items-center gap-0.5">
                                            View Pantry <ArrowRight className="h-3 w-3" />
                                        </Link>
                                    </div>
                                    <div className="px-3 pb-3">
                                        {pantryAlerts.length > 0 ? (
                                            <div className="divide-y divide-border/50">
                                                {pantryAlerts.map((item) => {
                                                    const days = getDaysUntilExpiry(item.expiryDate!);
                                                    return (
                                                        <div key={item.id} className="flex items-center justify-between px-2 py-2.5">
                                                            <span className="text-[13px] font-medium truncate">{item.name}</span>
                                                            <span className={`text-[12px] font-semibold shrink-0 ml-3 px-2 py-0.5 rounded-full ${
                                                                days <= 1
                                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                                    : days <= 3
                                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                    : 'bg-muted text-muted-foreground'
                                                            }`}>
                                                                {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d left`}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="py-8 text-center">
                                                <Check className="h-8 w-8 text-green-500/40 mx-auto mb-2" />
                                                <p className="text-[13px] text-muted-foreground">Nothing expiring soon</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Grocery List */}
                                <div className={card}>
                                    <div className="flex items-center justify-between px-5 pt-4 pb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(10,132,255,0.1)' }}>
                                                <ShoppingCart className="h-4 w-4" style={{ color: '#0A84FF' }} />
                                            </div>
                                            <h3 className="text-[15px] font-semibold">Grocery List</h3>
                                            {groceryCount > 0 && (
                                                <span className="text-[11px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">{groceryCount}</span>
                                            )}
                                        </div>
                                        <Link href="/grocery-list" className="text-[12px] font-semibold text-primary hover:text-primary/70 transition-colors flex items-center gap-0.5">
                                            Full List <ArrowRight className="h-3 w-3" />
                                        </Link>
                                    </div>
                                    <div className="px-3 pb-3">
                                        {groceryItems.length > 0 ? (
                                            <div className="divide-y divide-border/50">
                                                {groceryItems.map((item) => (
                                                    <div key={item.id} className="flex items-center justify-between px-2 py-2.5">
                                                        <span className="text-[13px] font-medium truncate">{item.name}</span>
                                                        {item.quantity && (
                                                            <span className="text-[12px] text-muted-foreground shrink-0 ml-3">{item.quantity}</span>
                                                        )}
                                                    </div>
                                                ))}
                                                {groceryCount > 8 && (
                                                    <div className="px-2 py-2 text-center">
                                                        <span className="text-[12px] text-muted-foreground">+{groceryCount - 8} more items</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="py-8 text-center">
                                                <Check className="h-8 w-8 text-green-500/40 mx-auto mb-2" />
                                                <p className="text-[13px] text-muted-foreground">Your grocery list is empty</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            </div>
                            <DietaryDialog
                                isOpen={dietModal}
                                closePopup={closeDiet}
                                diets={diets}
                                setDiets={setDiets}
                                intolerances={intolerances}
                                setIntolerances={setIntolerances}
                            />

                            <AddToCollectionDialog isOpen={collectionDialog.isOpen} onOpenChange={collectionDialog.setIsOpen} recipe={collectionDialog.recipe} />
                        </main>
                    </div>
                </div>
            </SidebarProvider>
        </RequireAuth>
    );
}
