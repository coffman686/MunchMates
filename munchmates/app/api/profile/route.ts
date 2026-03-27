// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { prisma } from "@/lib/prisma";

const toNullableInt = (value: unknown): number | null => {
    if (value === "" || value === undefined || value === null) return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

export async function GET(req: NextRequest) {
    try {
        const p = await verifyBearer(req.headers.get("authorization") || undefined);

        const profile = await prisma.userProfile.findUnique({
            where: { userId: p.sub },
        });

        return NextResponse.json({
            favoriteCuisines: profile?.favoriteCuisines ?? "",
            diets: profile?.diets ?? [],
            intolerances: profile?.intolerances ?? [],
            dailyCalorieGoal: profile?.dailyCalorieGoal ?? null,
            dailyProteinGoal: profile?.dailyProteinGoal ?? null,
            dailyCarbGoal: profile?.dailyCarbGoal ?? null,
            dailyFatGoal: profile?.dailyFatGoal ?? null,
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
            dailyCalorieGoal: toNullableInt(body.dailyCalorieGoal),
            dailyProteinGoal: toNullableInt(body.dailyProteinGoal),
            dailyCarbGoal: toNullableInt(body.dailyCarbGoal),
            dailyFatGoal: toNullableInt(body.dailyFatGoal),
        };

        await prisma.user.upsert({
            where: { id: p.sub },
            update: { name: p.name ?? "", username: p.preferred_username ?? "" },
            create: { id: p.sub, name: p.name ?? "", username: p.preferred_username ?? "" },
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
                dailyCalorieGoal: profile.dailyCalorieGoal,
                dailyProteinGoal: profile.dailyProteinGoal,
                dailyCarbGoal: profile.dailyCarbGoal,
                dailyFatGoal: profile.dailyFatGoal,
            },
        });
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/profile:");
    }
}