// app/api/grocery/categories/route.ts
// Endpoint to manage user's custom grocery categories
// Backed by Postgres via Prisma — data persists across server restarts

import { NextRequest, NextResponse } from "next/server";
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
        if (error instanceof Error && error.message === "no token") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("Error in GET /api/grocery/categories:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST /api/grocery/categories — Add new category
export async function POST(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const body = await req.json();

        if (!body.name) {
            return NextResponse.json(
                { error: "Missing required field: name" },
                { status: 400 }
            );
        }

        const name = String(body.name).trim().slice(0, 100);

        // Check if category already exists
        const existing = await prisma.groceryCategory.findFirst({
            where: { userId: p.sub, name },
        });

        if (existing) {
            return NextResponse.json(
                { error: "Category already exists" },
                { status: 409 }
            );
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
        if (error instanceof Error && error.message === "no token") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("Error in POST /api/grocery/categories:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// DELETE /api/grocery/categories?name= — Remove category (reassign items to first remaining)
export async function DELETE(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const { searchParams } = new URL(req.url);
        const name = searchParams.get("name");

        if (!name) {
            return NextResponse.json({ error: "Missing required param: name" }, { status: 400 });
        }

        // Find the category to delete
        const categoryToDelete = await prisma.groceryCategory.findFirst({
            where: { userId: p.sub, name },
        });

        if (!categoryToDelete) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
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
        if (error instanceof Error && error.message === "no token") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("Error in DELETE /api/grocery/categories:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
