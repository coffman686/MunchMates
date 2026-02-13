// meal-plan/route.ts
// Fetches and updates weekly meal plan information
// Verifies user token before performing any action
// GET:
// - Gets the current meal plan
// - Requires input week number
// - Returns null if no plan was found
// POST:
// - Updates a given meal plan by week number
// - Validates meal plan correctness and week
// Backed by Postgres via Prisma — data persists across server restarts.

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";
import { WeeklyMealPlan, DayPlan, MealPlanEntry } from "@/lib/types/meal-plan";

// Reconstruct the frontend-compatible DayPlan[] shape from flat MealEntry rows
function buildWeeklyPlan(
  weekStart: string,
  meals: {
    date: string;
    mealType: string;
    entryId: string;
    recipeId: number;
    title: string;
    image: string | null;
    servings: number;
    originalServings: number;
  }[],
  days: DayPlan[]
): WeeklyMealPlan {
  // Build a map of date -> mealType -> entry
  const mealMap = new Map<string, Map<string, MealPlanEntry>>();
  for (const meal of meals) {
    if (!mealMap.has(meal.date)) mealMap.set(meal.date, new Map());
    mealMap.get(meal.date)!.set(meal.mealType, {
      id: meal.entryId,
      recipeId: meal.recipeId,
      title: meal.title,
      image: meal.image ?? undefined,
      servings: meal.servings,
      originalServings: meal.originalServings,
    });
  }

  // Fill each day with its meals
  const resultDays: DayPlan[] = days.map((day) => {
    const dayMeals = mealMap.get(day.date);
    return {
      date: day.date,
      breakfast: dayMeals?.get("breakfast"),
      lunch: dayMeals?.get("lunch"),
      dinner: dayMeals?.get("dinner"),
    };
  });

  return { weekStart, days: resultDays };
}

export async function GET(req: NextRequest) {
  try {
    const payload = await verifyBearer(req.headers.get("authorization") || undefined);

    const weekStart = req.nextUrl.searchParams.get("weekStart");
    if (!weekStart) {
      return errorResponse(400, "weekStart parameter required");
    }

    const mealPlan = await prisma.weeklyMealPlan.findUnique({
      where: { userId_weekStart: { userId: payload.sub, weekStart } },
      include: { meals: true },
    });

    if (!mealPlan) {
      return NextResponse.json({ plan: null });
    }

    // Generate the 7-day structure for the week
    const startDate = new Date(weekStart + "T00:00:00");
    const days: DayPlan[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      days.push({ date: `${year}-${month}-${day}` });
    }

    const plan = buildWeeklyPlan(weekStart, mealPlan.meals, days);
    return NextResponse.json({ plan });
  } catch (error) {
    return handleRouteError(error, "Error in GET /api/meal-plan:");
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await verifyBearer(req.headers.get("authorization") || undefined);

    const body = await req.json();

    if (!body.plan || !body.plan.weekStart) {
      return errorResponse(400, "Invalid meal plan data");
    }

    const plan: WeeklyMealPlan = body.plan;
    const userId = payload.sub;

    // Ensure User record exists
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    // Collect all meal entries from the plan
    const mealEntries: {
      date: string;
      mealType: string;
      entryId: string;
      recipeId: number;
      title: string;
      image: string | null;
      servings: number;
      originalServings: number;
    }[] = [];

    for (const day of plan.days) {
      for (const mealType of ["breakfast", "lunch", "dinner"] as const) {
        const entry = day[mealType];
        if (entry) {
          mealEntries.push({
            date: day.date,
            mealType,
            entryId: entry.id,
            recipeId: entry.recipeId,
            title: entry.title,
            image: entry.image ?? null,
            servings: entry.servings,
            originalServings: entry.originalServings,
          });
        }
      }
    }

    // Transaction: upsert the plan, delete old meals, create new ones
    await prisma.$transaction(async (tx) => {
      const mealPlan = await tx.weeklyMealPlan.upsert({
        where: { userId_weekStart: { userId, weekStart: plan.weekStart } },
        update: {},
        create: { userId, weekStart: plan.weekStart },
      });

      await tx.mealEntry.deleteMany({
        where: { mealPlanId: mealPlan.id },
      });

      if (mealEntries.length > 0) {
        await tx.mealEntry.createMany({
          data: mealEntries.map((entry) => ({
            mealPlanId: mealPlan.id,
            ...entry,
          })),
        });
      }
    });

    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    return handleRouteError(error, "Error in POST /api/meal-plan:");
  }
}
