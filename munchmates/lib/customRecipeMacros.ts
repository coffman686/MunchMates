import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CustomRecipeMacros = {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
};

let ensureMacroColumnsPromise: Promise<void> | null = null;

export function normalizeCustomRecipeMacros(
    macros: Partial<CustomRecipeMacros>
): CustomRecipeMacros {
    return {
        calories: macros.calories ?? null,
        protein: macros.protein ?? null,
        carbs: macros.carbs ?? null,
        fat: macros.fat ?? null,
    };
}

export async function ensureCustomRecipeMacroColumns() {
    if (!ensureMacroColumnsPromise) {
        ensureMacroColumnsPromise = (async () => {
            await prisma.$executeRawUnsafe(`
                ALTER TABLE "CustomRecipe"
                ADD COLUMN IF NOT EXISTS "calories" DOUBLE PRECISION,
                ADD COLUMN IF NOT EXISTS "protein" DOUBLE PRECISION,
                ADD COLUMN IF NOT EXISTS "carbs" DOUBLE PRECISION,
                ADD COLUMN IF NOT EXISTS "fat" DOUBLE PRECISION;
            `);
        })().catch((error) => {
            ensureMacroColumnsPromise = null;
            throw error;
        });
    }

    await ensureMacroColumnsPromise;
}

export async function persistCustomRecipeMacros(
    recipeId: number,
    macros: Partial<CustomRecipeMacros>
) {
    const normalized = normalizeCustomRecipeMacros(macros);
    await ensureCustomRecipeMacroColumns();
    await prisma.$executeRaw`
        UPDATE "CustomRecipe"
        SET
            "calories" = ${normalized.calories},
            "protein" = ${normalized.protein},
            "carbs" = ${normalized.carbs},
            "fat" = ${normalized.fat}
        WHERE "id" = ${recipeId}
    `;
}

type MacroRow = {
    id: number;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
};

export async function loadCustomRecipeMacrosByIds(recipeIds: number[]) {
    if (recipeIds.length === 0) {
        return new Map<number, CustomRecipeMacros>();
    }

    await ensureCustomRecipeMacroColumns();

    const uniqueRecipeIds = Array.from(new Set(recipeIds));
    const rows = await prisma.$queryRaw<MacroRow[]>(
        Prisma.sql`
            SELECT "id", "calories", "protein", "carbs", "fat"
            FROM "CustomRecipe"
            WHERE "id" IN (${Prisma.join(uniqueRecipeIds)})
        `
    );

    return new Map(
        rows.map((row) => [
            row.id,
            normalizeCustomRecipeMacros(row),
        ])
    );
}
