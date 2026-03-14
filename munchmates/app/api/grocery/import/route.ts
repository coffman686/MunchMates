// app/api/grocery/import/route.ts
// Endpoint to import aggregated ingredients from meal plan into grocery list
// Backed by Postgres via Prisma — data persists across server restarts

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { formatQuantity, mergeQuantityStrings } from "@/lib/grocery-consolidation";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";
import { normalize } from "@/lib/normalize";

interface AggregatedIngredient {
    name: string;
    totalAmount: number;
    unit: string;
    category: string;
}

// POST /api/grocery/import — Import ingredients from meal plan
// Body: { items: AggregatedIngredient[] }
export async function POST(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const body = await req.json();

        if (!body.items || !Array.isArray(body.items)) {
            return errorResponse(400, "Missing required field: items (array)");
        }

        const aggregatedItems: AggregatedIngredient[] = body.items;

        // Ensure User record exists
        await prisma.user.upsert({
            where: { id: p.sub },
            update: { name: p.name ?? "", username: p.preferred_username ?? "" },
            create: { id: p.sub, name: p.name ?? "", username: p.preferred_username ?? "" },
        });

        // Get existing items for this user
        const existingItems = await prisma.groceryItem.findMany({
            where: { userId: p.sub },
        });
        const existingByName = new Map(
            existingItems.map((item) => [normalize(item.name), item])
        );

        // Fetch pantry items to filter out ingredients user already has
        const pantryItems = await prisma.pantryItem.findMany({
            where: { userId: p.sub },
            select: { canonName: true, name: true },
        });
        const pantryCanonNames = new Set(
            pantryItems.map((item) => item.canonName || normalize(item.name))
        );

        // Ensure categories exist
        const existingCategories = await prisma.groceryCategory.findMany({
            where: { userId: p.sub },
        });
        const categoryNames = new Set(existingCategories.map((c) => c.name));
        const maxSort = existingCategories.reduce(
            (max, c) => Math.max(max, c.sortOrder),
            -1
        );

        let sortCounter = maxSort + 1;
        const newCategories: { userId: string; name: string; sortOrder: number }[] = [];

        for (const ingredient of aggregatedItems) {
            if (ingredient.category && !categoryNames.has(ingredient.category)) {
                categoryNames.add(ingredient.category);
                newCategories.push({
                    userId: p.sub,
                    name: ingredient.category,
                    sortOrder: sortCounter++,
                });
            }
        }

        if (newCategories.length > 0) {
            await prisma.groceryCategory.createMany({ data: newCategories });
        }

        // Process each ingredient
        let addedCount = 0;
        let updatedCount = 0;
        let filteredCount = 0;

        for (const ingredient of aggregatedItems) {
            const name = String(ingredient.name).trim().slice(0, 200);
            const nameLower = normalize(name);

            // Skip items the user already has in their pantry
            if (pantryCanonNames.has(nameLower)) {
                filteredCount++;
                continue;
            }

            const quantity = formatQuantity(ingredient.totalAmount, ingredient.unit);
            const category = String(ingredient.category || "Uncategorized")
                .trim()
                .slice(0, 100);

            const existing = existingByName.get(nameLower);

            if (existing) {
                const newQuantity = mergeQuantityStrings(
                    existing.quantity,
                    ingredient.totalAmount,
                    ingredient.unit
                );

                await prisma.groceryItem.update({
                    where: { id: existing.id },
                    data: {
                        quantity: newQuantity,
                        fromMealPlan: true,
                    },
                });
                existingByName.set(nameLower, {
                    ...existing,
                    quantity: newQuantity,
                    fromMealPlan: true,
                });
                updatedCount++;
            } else {
                // Create new item
                const newItem = await prisma.groceryItem.create({
                    data: {
                        userId: p.sub,
                        name,
                        quantity: quantity || null,
                        category,
                        completed: false,
                        fromMealPlan: true,
                    },
                });
                existingByName.set(nameLower, newItem);
                addedCount++;
            }
        }

        return NextResponse.json({
            ok: true,
            message: "Items imported from meal plan",
            addedCount,
            updatedCount,
            filteredCount,
            totalProcessed: aggregatedItems.length,
        });
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/grocery/import:");
    }
}
