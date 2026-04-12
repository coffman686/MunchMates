// app/api/pantry/route.ts
// Endpoint to manage user's pantry items (ingredient inventory)
// Backed by Postgres via Prisma — data persists across server restarts
// Supports structured amount+unit alongside legacy quantity string

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";
import { normalize } from "@/lib/normalize";
import { parseQuantity } from "@/lib/parseQuantity";

function formatItemResponse(item: {
    id: number;
    name: string;
    canonName: string;
    quantity: string;
    amount: number | null;
    unit: string;
    category: string;
    expiryDate: Date | null;
    addedAt: Date;
}) {
    // Lazy-parse amount from quantity string for legacy items
    let amount = item.amount;
    let unit = item.unit;
    if (amount === null && item.quantity) {
        const parsed = parseQuantity(item.quantity);
        if (parsed) {
            amount = parsed.amount;
            unit = parsed.unit;
        }
    }

    return {
        id: item.id,
        name: item.name,
        canonName: item.canonName || normalize(item.name),
        quantity: item.quantity,
        amount,
        unit,
        category: item.category,
        expiryDate: item.expiryDate?.toISOString().split("T")[0] ?? null,
        addedAt: item.addedAt.toISOString().split("T")[0],
    };
}

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
            items: items.map(formatItemResponse),
            count: items.length,
        });
    } catch (error) {
        return handleRouteError(error, "Error in GET /api/pantry:");
    }
}

// POST /api/pantry — Add new pantry item
export async function POST(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const body = await req.json();

        // Accept structured amount+unit or legacy quantity
        const hasStructured = body.amount !== undefined && body.amount !== null;

        if (!body.name || !body.category) {
            return errorResponse(400, "Missing required fields: name, category");
        }
        if (!hasStructured && !body.quantity) {
            return errorResponse(400, "Missing required field: quantity (or amount)");
        }

        // Sanitize inputs
        const name = String(body.name).trim().slice(0, 200);
        const category = String(body.category).trim().slice(0, 100);
        const expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;

        let amount: number | null = null;
        let unit = "";
        let quantity: string;

        if (hasStructured) {
            amount = Number(body.amount);
            unit = String(body.unit || "").trim().slice(0, 50);
            quantity = body.quantity
                ? String(body.quantity).trim().slice(0, 100)
                : `${amount} ${unit}`.trim();
        } else {
            quantity = String(body.quantity).trim().slice(0, 100);
            // Attempt to parse structured data from quantity string
            const parsed = parseQuantity(quantity);
            if (parsed) {
                amount = parsed.amount;
                unit = parsed.unit;
            }
        }

        // Ensure User record exists
        await prisma.user.upsert({
            where: { id: p.sub },
            update: {},
            create: { id: p.sub },
        });

        // Check for existing item by canonical name to prevent duplicates
        // (e.g. "eggs" and "Eggs" should be the same item)
        const canonName = normalize(name);
        const existing = await prisma.pantryItem.findFirst({
            where: { userId: p.sub, canonName },
        });

        let item;
        if (existing) {
            // Update the existing item
            item = await prisma.pantryItem.update({
                where: { id: existing.id },
                data: {
                    quantity,
                    amount,
                    unit,
                    category,
                    expiryDate,
                    canonName,
                },
            });
        } else {
            item = await prisma.pantryItem.create({
                data: {
                    userId: p.sub,
                    name,
                    canonName,
                    quantity,
                    amount,
                    unit,
                    category,
                    expiryDate,
                },
            });
        }

        return NextResponse.json({
            ok: true,
            message: "Item added",
            item: formatItemResponse(item),
        });
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/pantry:");
    }
}

// PUT /api/pantry — Update existing item (by id in body)
export async function PUT(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const body = await req.json();

        if (!body.id) {
            return errorResponse(400, "Missing required field: id");
        }

        // Verify item belongs to user
        const existing = await prisma.pantryItem.findFirst({
            where: { id: body.id, userId: p.sub },
        });

        if (!existing) {
            return errorResponse(404, "Item not found");
        }

        // Build update data
        const updateData: {
            name?: string;
            canonName?: string;
            quantity?: string;
            amount?: number | null;
            unit?: string;
            category?: string;
            expiryDate?: Date | null;
        } = {};

        if (body.name !== undefined) {
            updateData.name = String(body.name).trim().slice(0, 200);
            updateData.canonName = normalize(updateData.name);
        }

        const hasStructured = body.amount !== undefined && body.amount !== null;

        if (hasStructured) {
            updateData.amount = Number(body.amount);
            updateData.unit = String(body.unit || "").trim().slice(0, 50);
            updateData.quantity = body.quantity
                ? String(body.quantity).trim().slice(0, 100)
                : `${updateData.amount} ${updateData.unit}`.trim();
        } else if (body.quantity !== undefined) {
            updateData.quantity = String(body.quantity).trim().slice(0, 100);
            const parsed = parseQuantity(updateData.quantity);
            if (parsed) {
                updateData.amount = parsed.amount;
                updateData.unit = parsed.unit;
            }
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
            item: formatItemResponse(item),
        });
    } catch (error) {
        return handleRouteError(error, "Error in PUT /api/pantry:");
    }
}

// DELETE /api/pantry?id= — Remove item by id, or clear all items when no id is provided
export async function DELETE(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            await prisma.pantryItem.deleteMany({
                where: { userId: p.sub },
            });

            return NextResponse.json({ ok: true, message: "Pantry cleared" });
        }

        const itemId = parseInt(id, 10);
        if (isNaN(itemId)) {
            return errorResponse(400, "Invalid id");
        }

        // Verify item belongs to user before deleting
        const existing = await prisma.pantryItem.findFirst({
            where: { id: itemId, userId: p.sub },
        });

        if (!existing) {
            return errorResponse(404, "Item not found");
        }

        await prisma.pantryItem.delete({
            where: { id: itemId },
        });

        return NextResponse.json({ ok: true, message: "Item deleted" });
    } catch (error) {
        return handleRouteError(error, "Error in DELETE /api/pantry:");
    }
}
