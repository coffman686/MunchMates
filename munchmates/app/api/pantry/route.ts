// app/api/pantry/route.ts
// Endpoint to manage user's pantry items (ingredient inventory)
// Backed by Postgres via Prisma — data persists across server restarts
// Supports structured amount+unit alongside legacy quantity string

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";
import {
    addPantryItem,
    deletePantryItem,
    formatPantryItemResponse,
    PantryServiceError,
    updatePantryItem,
} from "@/lib/pantry-service";

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
            items: items.map(formatPantryItemResponse),
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
        const item = await addPantryItem(prisma, p.sub, body);

        return NextResponse.json({
            ok: true,
            message: "Item added",
            item: formatPantryItemResponse(item),
        });
    } catch (error) {
        if (error instanceof PantryServiceError) {
            return errorResponse(error.status, error.message);
        }
        return handleRouteError(error, "Error in POST /api/pantry:");
    }
}

// PUT /api/pantry — Update existing item (by id in body)
export async function PUT(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const body = await req.json();
        const item = await updatePantryItem(prisma, p.sub, body);

        return NextResponse.json({
            ok: true,
            message: "Item updated",
            item: formatPantryItemResponse(item),
        });
    } catch (error) {
        if (error instanceof PantryServiceError) {
            return errorResponse(error.status, error.message);
        }
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

        await deletePantryItem(prisma, p.sub, searchParams.get("id"));

        return NextResponse.json({ ok: true, message: "Item deleted" });
    } catch (error) {
        if (error instanceof PantryServiceError) {
            return errorResponse(error.status, error.message);
        }
        return handleRouteError(error, "Error in DELETE /api/pantry:");
    }
}
