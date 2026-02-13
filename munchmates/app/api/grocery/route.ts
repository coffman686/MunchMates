// app/api/grocery/route.ts
// Endpoint to manage user's grocery list items
// Backed by Postgres via Prisma — data persists across server restarts

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";

// GET /api/grocery — List all grocery items for user
export async function GET(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);

        // Ensure User record exists
        await prisma.user.upsert({
            where: { id: p.sub },
            update: {},
            create: { id: p.sub },
        });

        const items = await prisma.groceryItem.findMany({
            where: { userId: p.sub },
            orderBy: { addedAt: "desc" },
        });

        return NextResponse.json({
            ok: true,
            items: items.map((item) => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                category: item.category,
                completed: item.completed,
                fromMealPlan: item.fromMealPlan,
                addedAt: item.addedAt.toISOString(),
            })),
            count: items.length,
        });
    } catch (error) {
        return handleRouteError(error, "Error in GET /api/grocery:");
    }
}

// POST /api/grocery — Add new grocery item
export async function POST(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const body = await req.json();

        // Validate required fields
        if (!body.name || !body.category) {
            return errorResponse(400, "Missing required fields: name, category");
        }

        // Sanitize inputs
        const name = String(body.name).trim().slice(0, 200);
        const quantity = body.quantity ? String(body.quantity).trim().slice(0, 100) : null;
        const category = String(body.category).trim().slice(0, 100);
        const fromMealPlan = Boolean(body.fromMealPlan);

        // Ensure User record exists
        await prisma.user.upsert({
            where: { id: p.sub },
            update: {},
            create: { id: p.sub },
        });

        // Create or update item (upsert on name to prevent duplicates)
        const item = await prisma.groceryItem.upsert({
            where: {
                userId_name: { userId: p.sub, name },
            },
            update: {
                // If item exists, update quantity (append if both have values)
                quantity: quantity,
                category,
                fromMealPlan: fromMealPlan || undefined,
            },
            create: {
                userId: p.sub,
                name,
                quantity,
                category,
                fromMealPlan,
                completed: false,
            },
        });

        return NextResponse.json({
            ok: true,
            message: "Item added",
            item: {
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                category: item.category,
                completed: item.completed,
                fromMealPlan: item.fromMealPlan,
                addedAt: item.addedAt.toISOString(),
            },
        });
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/grocery:");
    }
}

// PUT /api/grocery — Update item (toggle completed, edit name/quantity/category)
export async function PUT(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const body = await req.json();

        if (!body.id) {
            return errorResponse(400, "Missing required field: id");
        }

        // Verify item belongs to user
        const existing = await prisma.groceryItem.findFirst({
            where: { id: body.id, userId: p.sub },
        });

        if (!existing) {
            return errorResponse(404, "Item not found");
        }

        // Build update data
        const updateData: {
            name?: string;
            quantity?: string | null;
            category?: string;
            completed?: boolean;
        } = {};

        if (body.name !== undefined) {
            updateData.name = String(body.name).trim().slice(0, 200);
        }
        if (body.quantity !== undefined) {
            updateData.quantity = body.quantity ? String(body.quantity).trim().slice(0, 100) : null;
        }
        if (body.category !== undefined) {
            updateData.category = String(body.category).trim().slice(0, 100);
        }
        if (body.completed !== undefined) {
            updateData.completed = Boolean(body.completed);
        }

        const item = await prisma.groceryItem.update({
            where: { id: body.id },
            data: updateData,
        });

        return NextResponse.json({
            ok: true,
            message: "Item updated",
            item: {
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                category: item.category,
                completed: item.completed,
                fromMealPlan: item.fromMealPlan,
                addedAt: item.addedAt.toISOString(),
            },
        });
    } catch (error) {
        return handleRouteError(error, "Error in PUT /api/grocery:");
    }
}

// DELETE /api/grocery?id= — Remove single item
export async function DELETE(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return errorResponse(400, "Missing required param: id");
        }

        const itemId = parseInt(id, 10);
        if (isNaN(itemId)) {
            return errorResponse(400, "Invalid id");
        }

        // Verify item belongs to user before deleting
        const existing = await prisma.groceryItem.findFirst({
            where: { id: itemId, userId: p.sub },
        });

        if (!existing) {
            return errorResponse(404, "Item not found");
        }

        await prisma.groceryItem.delete({
            where: { id: itemId },
        });

        return NextResponse.json({ ok: true, message: "Item deleted" });
    } catch (error) {
        return handleRouteError(error, "Error in DELETE /api/grocery:");
    }
}
