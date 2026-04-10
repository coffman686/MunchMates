// app/api/grocery/categories/route.ts
// Endpoint to manage user's custom grocery categories
// Backed by Postgres via Prisma — data persists across server restarts

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";

// Default categories seeded on first GET if user has none
const DEFAULT_CATEGORIES = [
    "Produce",
    "Dairy",
    "Meat & Seafood",
    "Pantry",
    "Bakery",
    "Frozen",
    "Spices & Seasonings",
    "Canned Goods",
    "Pasta & Grains",
    "Condiments",
    "Oils & Vinegars",
    "Baking",
    "Beverages",
];

// GET /api/grocery/categories — List user's categories (return defaults if none exist)
export async function GET(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);

        // Ensure User record exists
        await prisma.user.upsert({
            where: { id: p.sub },
            update: {},
            create: { id: p.sub },
        });

        let categories = await prisma.groceryCategory.findMany({
            where: { userId: p.sub },
            orderBy: { sortOrder: "asc" },
        });

        // Seed default categories if user has none
        if (categories.length === 0) {
            await prisma.groceryCategory.createMany({
                data: DEFAULT_CATEGORIES.map((name, index) => ({
                    userId: p.sub,
                    name,
                    sortOrder: index,
                })),
            });

            categories = await prisma.groceryCategory.findMany({
                where: { userId: p.sub },
                orderBy: { sortOrder: "asc" },
            });
        }

        return NextResponse.json({
            ok: true,
            categories: categories.map((cat) => ({
                id: cat.id,
                name: cat.name,
                sortOrder: cat.sortOrder,
            })),
            count: categories.length,
        });
    } catch (error) {
        return handleRouteError(error, "Error in GET /api/grocery/categories:");
    }
}

// POST /api/grocery/categories — Add new category
export async function POST(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const body = await req.json();

        if (!body.name) {
            return errorResponse(400, "Missing required field: name");
        }

        const name = String(body.name).trim().slice(0, 100);

        // Check if category already exists
        const existing = await prisma.groceryCategory.findFirst({
            where: { userId: p.sub, name },
        });

        if (existing) {
            return errorResponse(409, "Category already exists");
        }

        // Get max sortOrder to append at end
        const maxSort = await prisma.groceryCategory.findFirst({
            where: { userId: p.sub },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
        });

        const category = await prisma.groceryCategory.create({
            data: {
                userId: p.sub,
                name,
                sortOrder: (maxSort?.sortOrder ?? -1) + 1,
            },
        });

        return NextResponse.json({
            ok: true,
            message: "Category added",
            category: {
                id: category.id,
                name: category.name,
                sortOrder: category.sortOrder,
            },
        });
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/grocery/categories:");
    }
}

// DELETE /api/grocery/categories?name= — Remove category (reassign items to first remaining)
export async function DELETE(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const { searchParams } = new URL(req.url);
        const name = searchParams.get("name");

        if (!name) {
            return errorResponse(400, "Missing required param: name");
        }

        // Find the category to delete
        const categoryToDelete = await prisma.groceryCategory.findFirst({
            where: { userId: p.sub, name },
        });

        if (!categoryToDelete) {
            return errorResponse(404, "Category not found");
        }

        // Find remaining categories (excluding the one being deleted)
        const remainingCategories = await prisma.groceryCategory.findMany({
            where: { userId: p.sub, name: { not: name } },
            orderBy: { sortOrder: "asc" },
        });

        // Determine fallback category
        const fallbackCategory = remainingCategories[0]?.name ?? "Uncategorized";

        // Reassign items in deleted category to fallback
        await prisma.groceryItem.updateMany({
            where: { userId: p.sub, category: name },
            data: { category: fallbackCategory },
        });

        // Delete the category
        await prisma.groceryCategory.delete({
            where: { id: categoryToDelete.id },
        });

        return NextResponse.json({
            ok: true,
            message: "Category deleted",
            reassignedTo: fallbackCategory,
        });
    } catch (error) {
        return handleRouteError(error, "Error in DELETE /api/grocery/categories:");
    }
}
