'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/app-sidebar';
import {
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Loader2,
  Coffee,
  Utensils,
  Moon,
  Sparkles,
  ChevronDown,
  Check,
} from 'lucide-react';
import RequireAuth from '@/components/RequireAuth';
import { ensureToken } from '@/lib/keycloak';
import MealSlot from '@/components/meal-planner/MealSlot';
import RecipePickerDialog from '@/components/meal-planner/RecipePickerDialog';
import DraggableRecipeCard from '@/components/meal-planner/DraggableRecipeCard';
import {
  WeeklyMealPlan,
  DayPlan,
  MealPlanEntry,
  MealType,
  createEmptyWeekPlan,
  getWeekMonday,
  generateMealEntryId,
} from '@/lib/types/meal-plan';
import { aggregateIngredients } from '@/lib/ingredient-aggregator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner'];

const MEAL_ICONS = {
  breakfast: { icon: Coffee, color: '#FF9F0A', bg: 'bg-[#FF9F0A]/10' },
  lunch: { icon: Utensils, color: '#30D158', bg: 'bg-[#30D158]/10' },
  dinner: { icon: Moon, color: '#5E5CE6', bg: 'bg-[#5E5CE6]/10' },
};

const DIET_OPTIONS = [
  '', 'Gluten Free', 'Ketogenic', 'Vegetarian', 'Lacto-Vegetarian',
  'Ovo-Vegetarian', 'Vegan', 'Pescetarian', 'Paleo', 'Primal',
  'Low FODMAP', 'Whole30',
];

const MealPlanner = () => {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [weekPlan, setWeekPlan] = useState<WeeklyMealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingGrocery, setIsGeneratingGrocery] = useState(false);

  // autosave state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const weekPlanRef = useRef<WeeklyMealPlan | null>(null);
  const isInitialLoadRef = useRef(true);

  // generate preferences dropdown
  const [showGenPrefs, setShowGenPrefs] = useState(false);
  const [genCalories, setGenCalories] = useState('2000');
  const [genDiet, setGenDiet] = useState('');
  const [genExclude, setGenExclude] = useState('');

  // recipe picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ dayDate: string; mealType: MealType } | null>(null);

  // drag-and-drop state
  const [activeDragEntry, setActiveDragEntry] = useState<MealPlanEntry | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
    const savedDiet = localStorage.getItem('diets');
    if (savedDiet) {
      const diets = JSON.parse(savedDiet);
      if (diets.length > 0) setGenDiet(diets[0]);
    }
  }, []);

  const formatLocalDateStr = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const weekMonday = getWeekMonday(currentDate);
  const weekStartStr = formatLocalDateStr(weekMonday);

  const getWeekRange = (date: Date) => {
    const start = getWeekMonday(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      start: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      end: end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    };
  };

  const weekRange = getWeekRange(currentDate);

  const isCurrentWeek = (() => {
    const today = new Date();
    const todayMonday = getWeekMonday(today);
    return formatLocalDateStr(todayMonday) === weekStartStr;
  })();

  const doSave = useCallback(async (plan: WeeklyMealPlan) => {
    setSaveStatus('saving');
    try {
      const localKey = `mealPlan-${plan.weekStart}`;
      localStorage.setItem(localKey, JSON.stringify(plan));

      const token = await ensureToken();
      if (token) {
        await fetch('/api/meal-plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ plan }),
        });
      }
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to save meal plan:', error);
      setSaveStatus('idle');
    }
  }, []);

  useEffect(() => {
    const loadMealPlan = async () => {
      setIsLoading(true);
      isInitialLoadRef.current = true;
      try {
        const token = await ensureToken();
        const localKey = `mealPlan-${weekStartStr}`;
        const localData = localStorage.getItem(localKey);

        if (token) {
          const res = await fetch(`/api/meal-plan?weekStart=${weekStartStr}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.ok) {
            const data = await res.json();
            if (data.plan) {
              setWeekPlan(data.plan);
              localStorage.setItem(localKey, JSON.stringify(data.plan));
              setIsLoading(false);
              return;
            }
          }
        }

        if (localData) {
          setWeekPlan(JSON.parse(localData));
        } else {
          const monday = new Date(weekStartStr + 'T00:00:00');
          setWeekPlan(createEmptyWeekPlan(monday));
        }
      } catch (error) {
        console.error('Failed to load meal plan:', error);
        const monday = new Date(weekStartStr + 'T00:00:00');
        setWeekPlan(createEmptyWeekPlan(monday));
      } finally {
        setIsLoading(false);
      }
    };

    loadMealPlan();
  }, [weekStartStr]);

  useEffect(() => {
    weekPlanRef.current = weekPlan;

    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    if (!weekPlan) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      doSave(weekPlan);
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [weekPlan, doSave]);

  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      if (weekPlanRef.current) {
        doSave(weekPlanRef.current);
      }
    }
  }, [doSave]);

  const prevWeek = () => {
    flushSave();
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const nextWeek = () => {
    flushSave();
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    flushSave();
    setCurrentDate(new Date());
  };

  const updateDayPlan = (dayDate: string, mealType: MealType, entry: MealPlanEntry | undefined) => {
    if (!weekPlan) return;
    const newDays = weekPlan.days.map((day) => {
      if (day.date === dayDate) return { ...day, [mealType]: entry };
      return day;
    });
    setWeekPlan({ ...weekPlan, days: newDays });
  };

  const getEntry = (dayDate: string, mealType: MealType): MealPlanEntry | undefined => {
    if (!weekPlan) return undefined;
    const day = weekPlan.days.find((d) => d.date === dayDate);
    return day?.[mealType];
  };

  const handleAddRecipe = (dayDate: string, mealType: MealType) => {
    setSelectedSlot({ dayDate, mealType });
    setPickerOpen(true);
  };

  const handleSelectRecipe = (
    recipe: { id: number; title: string; image: string; servings: number; readyInMinutes?: number },
    selectedDays: string[]
  ) => {
    if (!selectedSlot || !weekPlan) return;
    const newDays = weekPlan.days.map((day) => {
      if (selectedDays.includes(day.date)) {
        const entry: MealPlanEntry = {
          id: generateMealEntryId(),
          recipeId: recipe.id,
          title: recipe.title,
          image: recipe.image,
          servings: recipe.servings,
          originalServings: recipe.servings,
          readyInMinutes: recipe.readyInMinutes,
        };
        return { ...day, [selectedSlot.mealType]: entry };
      }
      return day;
    });
    setWeekPlan({ ...weekPlan, days: newDays });
    setSelectedSlot(null);
  };

  const handleUpdateServings = (dayDate: string, mealType: MealType, newServings: number) => {
    if (!weekPlan || newServings < 1) return;
    const newDays = weekPlan.days.map((day) => {
      if (day.date === dayDate && day[mealType]) {
        return { ...day, [mealType]: { ...day[mealType], servings: newServings } };
      }
      return day;
    });
    setWeekPlan({ ...weekPlan, days: newDays });
  };

  const getAvailableDays = () => {
    if (!weekPlan) return [];
    return weekPlan.days.map((day) => ({
      date: day.date,
      label: new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    }));
  };

  const handleRemoveRecipe = (dayDate: string, mealType: MealType) => {
    updateDayPlan(dayDate, mealType, undefined);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const entry = active.data.current?.entry as MealPlanEntry | undefined;
    setActiveDragEntry(entry || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragEntry(null);
    if (!over || !weekPlan) return;

    const sourceEntry = active.data.current?.entry as MealPlanEntry;
    const targetData = over.data.current as { dayDate: string; mealType: MealType };
    if (!sourceEntry || !targetData) return;

    let sourceDayDate: string | null = null;
    let sourceMealType: MealType | null = null;

    for (const day of weekPlan.days) {
      for (const meal of MEALS) {
        if (day[meal]?.id === sourceEntry.id) {
          sourceDayDate = day.date;
          sourceMealType = meal;
          break;
        }
      }
      if (sourceDayDate) break;
    }

    if (!sourceDayDate || !sourceMealType) return;

    const targetEntry = getEntry(targetData.dayDate, targetData.mealType);
    const newDays = weekPlan.days.map((day) => {
      const updated: DayPlan = { ...day };
      if (day.date === sourceDayDate) updated[sourceMealType!] = targetEntry;
      if (day.date === targetData.dayDate) updated[targetData.mealType] = sourceEntry;
      return updated;
    });

    setWeekPlan({ ...weekPlan, days: newDays });
  };

  const handleGenerateMealPlan = async () => {
    if (!weekPlan) return;
    setIsGenerating(true);
    setShowGenPrefs(false);
    try {
      const params = new URLSearchParams({ timeFrame: 'week' });
      if (genCalories) params.set('targetCalories', genCalories);
      if (genDiet && genDiet !== '__none') params.set('diet', genDiet);
      if (genExclude) params.set('exclude', genExclude);

      const res = await fetch(`/api/spoonacular/recipes/generateMealPlan?${params}`);
      if (!res.ok) throw new Error('Failed to generate meal plan');
      const data = await res.json();

      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const mealSlots: MealType[] = ['breakfast', 'lunch', 'dinner'];

      const newDays = weekPlan.days.map((day, idx) => {
        const spoonDay = data.week?.[dayNames[idx]];
        if (!spoonDay?.meals) return day;

        const updated: DayPlan = { ...day };
        spoonDay.meals.forEach((meal: { id: number; title: string; servings: number; readyInMinutes?: number }, mealIdx: number) => {
          if (mealIdx < 3) {
            updated[mealSlots[mealIdx]] = {
              id: generateMealEntryId(),
              recipeId: meal.id,
              title: meal.title,
              image: `https://img.spoonacular.com/recipes/${meal.id}-312x231.jpg`,
              servings: meal.servings || 1,
              originalServings: meal.servings || 1,
              readyInMinutes: meal.readyInMinutes,
            };
          }
        });
        return updated;
      });

      setWeekPlan({ ...weekPlan, days: newDays });
    } catch (error) {
      console.error('Failed to generate meal plan:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateGroceryList = async () => {
    if (!weekPlan) return;
    setIsGeneratingGrocery(true);
    try {
      const aggregated = await aggregateIngredients(weekPlan);
      localStorage.setItem('pending-grocery-items', JSON.stringify(aggregated));
      router.push('/grocery-list?fromMealPlan=true');
    } catch (error) {
      console.error('Failed to generate grocery list:', error);
    } finally {
      setIsGeneratingGrocery(false);
    }
  };

  const hasRecipes = weekPlan?.days.some((day) => day.breakfast || day.lunch || day.dinner);

  const mealCount = weekPlan?.days.reduce((count, day) => {
    return count + (day.breakfast ? 1 : 0) + (day.lunch ? 1 : 0) + (day.dinner ? 1 : 0);
  }, 0) ?? 0;

  return (
    <RequireAuth>
      <SidebarProvider defaultOpen={false}>
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="min-h-screen flex w-full overflow-hidden">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <main className="flex-1 p-4 sm:p-6 bg-muted/30 overflow-x-hidden">
                <div className="w-full space-y-5">
                  {/* Gradient banner header */}
                  <div className="relative">
                    <div
                      className="rounded-2xl px-4 sm:px-6 py-4 shadow-sm"
                      style={{
                        background:
                          'linear-gradient(135deg, hsl(14 80% 52% / 0.22) 0%, hsl(30 90% 55% / 0.15) 50%, hsl(350 70% 60% / 0.10) 100%)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Left: week nav */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={prevWeek}
                            className="rounded-full h-9 w-9 flex-shrink-0 hover:bg-white/30"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </Button>

                          <div className="text-center flex flex-col items-center">
                            <h2 className="text-lg sm:text-xl font-bold text-foreground whitespace-nowrap">
                              {weekRange.start} — {weekRange.end}
                            </h2>
                            {!isCurrentWeek && (
                              <button
                                onClick={goToToday}
                                className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full hover:bg-primary/20 transition-colors mt-0.5"
                              >
                                ← Back to this week
                              </button>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={nextWeek}
                            className="rounded-full h-9 w-9 flex-shrink-0 hover:bg-white/30"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </Button>
                        </div>

                        {/* Right: action buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Save status */}
                          {saveStatus === 'saving' && (
                            <span className="text-xs text-foreground/60 flex items-center gap-1 whitespace-nowrap">
                              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                            </span>
                          )}
                          {saveStatus === 'saved' && (
                            <span className="text-xs text-foreground/60 flex items-center gap-1 whitespace-nowrap">
                              <Check className="h-3 w-3" /> Saved
                            </span>
                          )}

                          {/* Grocery list button */}
                          {hasRecipes && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleGenerateGroceryList}
                              disabled={isGeneratingGrocery}
                              className="rounded-full gap-1.5 h-9 bg-white/70 hover:bg-white border-white/50 shadow-sm"
                            >
                              {isGeneratingGrocery ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ShoppingCart className="h-3.5 w-3.5" />
                              )}
                              <span className="hidden sm:inline">Grocery List</span>
                            </Button>
                          )}

                          {/* Generate My Week split button */}
                          <div className="relative">
                            <div className="flex rounded-full overflow-hidden shadow-md">
                              <button
                                onClick={handleGenerateMealPlan}
                                disabled={isGenerating}
                                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 whitespace-nowrap"
                                style={{
                                  background: 'linear-gradient(135deg, hsl(14 80% 50%) 0%, hsl(30 90% 52%) 100%)',
                                }}
                              >
                                {isGenerating ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4" />
                                )}
                                <span className="hidden sm:inline">Generate My Week</span>
                                <span className="sm:hidden">Generate</span>
                              </button>
                              <button
                                onClick={() => setShowGenPrefs(!showGenPrefs)}
                                className="px-2.5 py-2 text-white border-l border-white/25"
                                style={{
                                  background: 'linear-gradient(135deg, hsl(14 80% 50%) 0%, hsl(30 90% 52%) 100%)',
                                }}
                              >
                                <ChevronDown className={`h-4 w-4 transition-transform ${showGenPrefs ? 'rotate-180' : ''}`} />
                              </button>
                            </div>

                            {/* Preferences dropdown */}
                            {showGenPrefs && (
                              <div className="absolute right-0 top-full mt-2 w-72 bg-card border rounded-2xl shadow-xl p-4 z-[100] space-y-3">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                    Daily Calories
                                  </label>
                                  <Input
                                    type="number"
                                    value={genCalories}
                                    onChange={(e) => setGenCalories(e.target.value)}
                                    placeholder="2000"
                                    className="h-8 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                    Diet
                                  </label>
                                  <Select value={genDiet} onValueChange={setGenDiet}>
                                    <SelectTrigger className="h-8 rounded-lg">
                                      <SelectValue placeholder="Any diet" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DIET_OPTIONS.map((diet) => (
                                        <SelectItem key={diet || '__none'} value={diet || '__none'}>
                                          {diet || 'Any diet'}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                    Exclude Ingredients
                                  </label>
                                  <Input
                                    value={genExclude}
                                    onChange={(e) => setGenExclude(e.target.value)}
                                    placeholder="e.g. shellfish, olives"
                                    className="h-8 rounded-lg"
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full rounded-lg"
                                  onClick={handleGenerateMealPlan}
                                  disabled={isGenerating}
                                >
                                  {isGenerating ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <Check className="h-4 w-4 mr-2" />
                                  )}
                                  Generate with Preferences
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Meal count bar */}
                      {hasRecipes && (
                        <div className="mt-3 bg-white/40 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center justify-center">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 min-w-[120px] max-w-[200px] bg-white/60 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${(mealCount / 21) * 100}%`,
                                  background: 'linear-gradient(90deg, hsl(14 80% 50%), hsl(30 90% 52%))',
                                }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-foreground/70">
                              {mealCount}/21 meals
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Meal planning grid */}
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="bg-background rounded-2xl shadow-sm border border-border/50 overflow-hidden">
                      {/* Column headers */}
                      <div className="hidden sm:flex items-center gap-3 px-3 py-3 border-b border-border/50 bg-muted/20">
                        <div className="w-16 flex-shrink-0" />
                        {MEALS.map((meal) => {
                          const { icon: Icon, color, bg } = MEAL_ICONS[meal];
                          return (
                            <div key={meal} className="flex-1 flex items-center justify-center gap-2">
                              <div className={`${bg} p-1.5 rounded-lg`}>
                                <Icon className="h-4 w-4" style={{ color }} />
                              </div>
                              <span className="font-semibold text-sm capitalize" style={{ color }}>{meal}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Day rows */}
                      <div className="divide-y divide-border/30">
                        {weekPlan?.days.map((day, dayIndex) => {
                          const dayDate = new Date(day.date + 'T00:00:00');
                          const today = new Date();
                          const todayStr = formatLocalDateStr(today);
                          const isToday = day.date === todayStr;
                          const isEven = dayIndex % 2 === 0;

                          return (
                            <div
                              key={day.date}
                              className={`flex items-stretch gap-2 sm:gap-3 px-3 py-3 transition-colors ${
                                isToday
                                  ? 'bg-primary/[0.07]'
                                  : isEven
                                    ? 'bg-muted/10'
                                    : 'bg-background'
                              }`}
                            >
                              <div className="w-16 flex-shrink-0 flex flex-col justify-center">
                                <p className={`font-bold text-base ${isToday ? 'text-primary' : 'text-foreground'}`}>
                                  {DAYS[dayIndex]}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {dayDate.toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </p>
                                {isToday && (
                                  <span className="inline-flex items-center text-[10px] font-semibold text-white bg-primary rounded-full px-1.5 py-0.5 mt-1 w-fit">
                                    TODAY
                                  </span>
                                )}
                              </div>

                              <div className="flex-1 flex gap-2 sm:gap-3 min-w-0">
                                {MEALS.map((mealType) => (
                                  <MealSlot
                                    key={mealType}
                                    dayDate={day.date}
                                    mealType={mealType}
                                    entry={getEntry(day.date, mealType)}
                                    onAddRecipe={() => handleAddRecipe(day.date, mealType)}
                                    onRemoveRecipe={() => handleRemoveRecipe(day.date, mealType)}
                                    onUpdateServings={(newServings) =>
                                      handleUpdateServings(day.date, mealType, newServings)
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </main>
            </div>
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeDragEntry && (
              <div className="opacity-80">
                <DraggableRecipeCard entry={activeDragEntry} onRemove={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <RecipePickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelectRecipe={handleSelectRecipe}
          currentDayDate={selectedSlot?.dayDate || ''}
          availableDays={getAvailableDays()}
        />
      </SidebarProvider>
    </RequireAuth>
  );
};

export default MealPlanner;
