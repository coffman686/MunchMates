// app/api/profile/route.ts
// Endpoint to retrieve and update user profile preferences (cuisines, diets, intolerances)
// Backed by Postgres via Prisma — data persists across server restarts

import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);

        const profile = await prisma.userProfile.findUnique({
            where: { userId: p.sub },
        });

        // Return stored profile or defaults
        return NextResponse.json({
            favoriteCuisines: profile?.favoriteCuisines ?? "",
            diets: profile?.diets ?? [],
            intolerances: profile?.intolerances ?? [],
        });
    } catch (error) {
        return handleRouteError(error, "Error in GET /api/profile:");
    }
}

export async function POST(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const body = await req.json();

        const data = {
            favoriteCuisines: body.favoriteCuisines ?? "",
            diets: body.diets ?? [],
            intolerances: body.intolerances ?? [],
        };

        // Ensure User record exists, then upsert profile
        await prisma.user.upsert({
            where: { id: p.sub },
            update: {},
            create: { id: p.sub },
        });

        const profile = await prisma.userProfile.upsert({
            where: { userId: p.sub },
            update: data,
            create: { userId: p.sub, ...data },
        });

        return NextResponse.json({
            ok: true,
            profile: {
                favoriteCuisines: profile.favoriteCuisines,
                diets: profile.diets,
                intolerances: profile.intolerances,
            },
        });
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/profile:");
    }
}
