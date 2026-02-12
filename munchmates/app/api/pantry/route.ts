// app/api/pantry/route.ts
// Endpoint to manage user's pantry items (ingredient inventory)
// Backed by Postgres via Prisma — data persists across server restarts

import { NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";

// GET /api/pantry — List all pantry items for user
export async function GET(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);

        // Ensure User record exists
        await prisma.user.upsert({
            where: { id: p.sub },
            update: {},
            create: { id: p.sub },
        });

        const items = await prisma.pantryItem.findMany({
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
                expiryDate: item.expiryDate?.toISOString().split("T")[0] ?? null,
                addedAt: item.addedAt.toISOString().split("T")[0],
            })),
            count: items.length,
        });
    } catch (error) {
        if (error instanceof Error && error.message === "no token") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("Error in GET /api/pantry:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST /api/pantry — Add new pantry item
export async function POST(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const body = await req.json();

        // Validate required fields
        if (!body.name || !body.quantity || !body.category) {
            return NextResponse.json(
                { error: "Missing required fields: name, quantity, category" },
                { status: 400 }
            );
        }

        // Sanitize inputs
        const name = String(body.name).trim().slice(0, 200);
        const quantity = String(body.quantity).trim().slice(0, 100);
        const category = String(body.category).trim().slice(0, 100);
        const expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;

        // Ensure User record exists
        await prisma.user.upsert({
            where: { id: p.sub },
            update: {},
            create: { id: p.sub },
        });

        // Create or update item (upsert on name to prevent duplicates)
        const item = await prisma.pantryItem.upsert({
            where: {
                userId_name: { userId: p.sub, name },
            },
            update: {
                quantity,
                category,
                expiryDate,
            },
            create: {
                userId: p.sub,
                name,
                quantity,
                category,
                expiryDate,
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
                expiryDate: item.expiryDate?.toISOString().split("T")[0] ?? null,
                addedAt: item.addedAt.toISOString().split("T")[0],
            },
        });
    } catch (error) {
        if (error instanceof Error && error.message === "no token") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("Error in POST /api/pantry:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// PUT /api/pantry — Update existing item (by id in body)
export async function PUT(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const body = await req.json();

        if (!body.id) {
            return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
        }

        // Verify item belongs to user
        const existing = await prisma.pantryItem.findFirst({
            where: { id: body.id, userId: p.sub },
        });

        if (!existing) {
            return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }

        // Build update data
        const updateData: {
            name?: string;
            quantity?: string;
            category?: string;
            expiryDate?: Date | null;
        } = {};

        if (body.name !== undefined) {
            updateData.name = String(body.name).trim().slice(0, 200);
        }
        if (body.quantity !== undefined) {
            updateData.quantity = String(body.quantity).trim().slice(0, 100);
        }
        if (body.category !== undefined) {
            updateData.category = String(body.category).trim().slice(0, 100);
        }
        if (body.expiryDate !== undefined) {
            updateData.expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
        }

        const item = await prisma.pantryItem.update({
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
                expiryDate: item.expiryDate?.toISOString().split("T")[0] ?? null,
                addedAt: item.addedAt.toISOString().split("T")[0],
            },
        });
    } catch (error) {
        if (error instanceof Error && error.message === "no token") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("Error in PUT /api/pantry:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// DELETE /api/pantry?id= — Remove item by id
export async function DELETE(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Missing required param: id" }, { status: 400 });
        }

        const itemId = parseInt(id, 10);
        if (isNaN(itemId)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        // Verify item belongs to user before deleting
        const existing = await prisma.pantryItem.findFirst({
            where: { id: itemId, userId: p.sub },
        });

        if (!existing) {
            return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }

        await prisma.pantryItem.delete({
            where: { id: itemId },
        });

        return NextResponse.json({ ok: true, message: "Item deleted" });
    } catch (error) {
        if (error instanceof Error && error.message === "no token") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("Error in DELETE /api/pantry:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
