export type MacroTotals = {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
};

export type MacroGoals = {
    dailyCalorieGoal: number | null;
    dailyProteinGoal: number | null;
    dailyCarbGoal: number | null;
    dailyFatGoal: number | null;
};

export function parseNutritionNumber(value: string | number | null | undefined): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (!value) return 0;
    const parsed = parseFloat(String(value).replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
}

export function scaleNutrition(
    totals: MacroTotals,
    factor: number
): MacroTotals {
    return {
        calories: totals.calories * factor,
        protein: totals.protein * factor,
        carbs: totals.carbs * factor,
        fat: totals.fat * factor,
    };
}

export function addNutrition(a: MacroTotals, b: MacroTotals): MacroTotals {
    return {
        calories: a.calories + b.calories,
        protein: a.protein + b.protein,
        carbs: a.carbs + b.carbs,
        fat: a.fat + b.fat,
    };
}

export function emptyNutrition(): MacroTotals {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

function buildMetric(current: number, target: number | null) {
    if (!target || target <= 0) {
        return {
            current: Math.round(current),
            target: null,
            percent: null,
            remaining: null,
            status: "no-goal" as const,
        };
    }

    const percent = Math.round((current / target) * 100);
    const remaining = Math.round(target - current);

    let status: "under" | "met" | "over";
    if (current > target) status = "over";
    else if (current >= target * 0.95) status = "met";
    else status = "under";

    return {
        current: Math.round(current),
        target,
        percent,
        remaining,
        status,
    };
}

export function buildNutritionProgress(totals: MacroTotals, goals: MacroGoals) {
    return {
        calories: buildMetric(totals.calories, goals.dailyCalorieGoal),
        protein: buildMetric(totals.protein, goals.dailyProteinGoal),
        carbs: buildMetric(totals.carbs, goals.dailyCarbGoal),
        fat: buildMetric(totals.fat, goals.dailyFatGoal),
    };
}