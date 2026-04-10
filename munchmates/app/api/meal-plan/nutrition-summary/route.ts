// app/api/meal-plan/nutrition-summary/route.ts
// Returns daily nutrition totals for a saved weekly meal plan and compares
// them against the authenticated user's dietary goals.

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";
import { getRecipeNutrition } from "@/lib/spoonacular";
import {
    emptyNutrition,
    addNutrition,
    scaleNutrition,
    parseNutritionNumber,
    buildNutritionProgress,
    type MacroTotals,
} from "@/lib/nutrition-goals";

type MealRow = {
    date: string;
    mealType: string;
    recipeId: number;
    title: string;
    servings: number;
    originalServings: number;
};

export async function GET(req: NextRequest) {
    try {
        const payload = await verifyBearer(req.headers.get("authorization") || undefined);

        const weekStart = req.nextUrl.searchParams.get("weekStart");
        if (!weekStart) {
            return errorResponse(400, "weekStart parameter required");
        }

        const [mealPlan, profile] = await Promise.all([
            prisma.weeklyMealPlan.findUnique({
                where: { userId_weekStart: { userId: payload.sub, weekStart } },
                include: { meals: true },
            }),
            prisma.userProfile.findUnique({
                where: { userId: payload.sub },
            }),
        ]);

        if (!mealPlan) {
            return NextResponse.json({ days: [] });
        }

        const goals = {
            dailyCalorieGoal: profile?.dailyCalorieGoal ?? null,
            dailyProteinGoal: profile?.dailyProteinGoal ?? null,
            dailyCarbGoal: profile?.dailyCarbGoal ?? null,
            dailyFatGoal: profile?.dailyFatGoal ?? null,
        };

        const mealsByDate = new Map<string, MealRow[]>();

        for (const meal of mealPlan.meals) {
            if (!mealsByDate.has(meal.date)) mealsByDate.set(meal.date, []);
            mealsByDate.get(meal.date)!.push({
                date: meal.date,
                mealType: meal.mealType,
                recipeId: meal.recipeId,
                title: meal.title,
                servings: meal.servings,
                originalServings: meal.originalServings,
            });
        }

        const startDate = new Date(weekStart + "T00:00:00");
        const dates: string[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            dates.push(`${year}-${month}-${day}`);
        }

        const days = await Promise.all(
            dates.map(async (date) => {
                const meals = mealsByDate.get(date) ?? [];
                let totals: MacroTotals = emptyNutrition();

                const mealBreakdown = await Promise.all(
                    meals.map(async (meal) => {
                        try {
                            // Minimal implementation assumes stored meal IDs are Spoonacular recipes.
                            const nutrition = await getRecipeNutrition(meal.recipeId);

                            const baseNutrition: MacroTotals = {
                                calories: parseNutritionNumber(nutrition.calories),
                                protein: parseNutritionNumber(nutrition.protein),
                                carbs: parseNutritionNumber(nutrition.carbs),
                                fat: parseNutritionNumber(nutrition.fat),
                            };

                            const factor =
                                meal.originalServings && meal.originalServings > 0
                                    ? meal.servings / meal.originalServings
                                    : 1;

                            const scaled = scaleNutrition(baseNutrition, factor);
                            totals = addNutrition(totals, scaled);

                            return {
                                mealType: meal.mealType,
                                recipeId: meal.recipeId,
                                title: meal.title,
                                servings: meal.servings,
                                originalServings: meal.originalServings,
                                nutrition: {
                                    calories: Math.round(scaled.calories),
                                    protein: Math.round(scaled.protein),
                                    carbs: Math.round(scaled.carbs),
                                    fat: Math.round(scaled.fat),
                                },
                            };
                        } catch (error) {
                            console.error(
                                `Failed to fetch nutrition for recipe ${meal.recipeId} on ${date}:`,
                                error
                            );

                            return {
                                mealType: meal.mealType,
                                recipeId: meal.recipeId,
                                title: meal.title,
                                servings: meal.servings,
                                originalServings: meal.originalServings,
                                nutrition: emptyNutrition(),
                            };
                        }
                    })
                );

                const roundedTotals: MacroTotals = {
                    calories: Math.round(totals.calories),
                    protein: Math.round(totals.protein),
                    carbs: Math.round(totals.carbs),
                    fat: Math.round(totals.fat),
                };

                return {
                    date,
                    totals: roundedTotals,
                    goals,
                    progress: buildNutritionProgress(roundedTotals, goals),
                    meals: mealBreakdown,
                };
            })
        );

        return NextResponse.json({ days });
    } catch (error) {
        return handleRouteError(
            error,
            "Error in GET /api/meal-plan/nutrition-summary:"
        );
    }
}
