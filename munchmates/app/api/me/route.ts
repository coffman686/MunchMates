// file: app/api/profile/route.ts
// Fetches user profile and preferences data
// GET:
// - Verifies user authorization
// - Retrieves favoride cuisines, diets, and intolerances
// - Handles nonexistent profiles and unauthorized users
// POST:
// - Verifies user authorization
// - Updates user profile and responds with updated profile
import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, errorResponse } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { rateLimiter } from "@/lib/rateLimiter";

type ProfileData = {
    favoriteCuisines: string;
    diets: string[];
    intolerances: string[];
};

// simple in-memory store keyed by user sub
const profiles = new Map<string, ProfileData>();

export async function GET(req: NextRequest) {
    try {
        // Rate limiting by IP address
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
        const { success } = await rateLimiter.limit(ip);
        if (!success) {
            return errorResponse(429, "Too Many Requests");
        }

        // Verify Bearer
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        // Get existing profile or construct blank template
        const existing =
            profiles.get(p.sub) ?? {
                favoriteCuisines: "",
                diets: [],
                intolerances: [],
            };

        // Return profile
        return NextResponse.json(existing);
    } catch (error) {
        return handleRouteError(error, "Error in GET /api/me");
    }
}

export async function POST(req: NextRequest) {
    try {
        // Rate limiting by IP address
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
        const { success } = await rateLimiter.limit(ip);
        if (!success) {
            return errorResponse(429, "Too Many Requests");
        }

        // Verify Bearer
        const p = await verifyBearer(req.headers.get("authorization") || undefined);
        const body = await req.json();

        // Construct a new update profile
        const update: ProfileData = {
            favoriteCuisines: body.favoriteCuisines ?? "",
            diets: body.diets ?? [],
            intolerances: body.intolerances ?? [],
        };

        // Update the user profile in-memory
        profiles.set(p.sub, update);

        // Return updated profile
        return NextResponse.json({ ok: true, profile: update });
    } catch (error) {
        return handleRouteError(error, "Error in POST /api/me");
    }
}
