// file: recipes/searchRecipeInstructions/route.ts
// GET endpoint to fetch recipe instructions
// Inputs: spooncular recipe ID
// Output:
// - Instructions to produce
// - 404 if valid ID not provided
// - 500 otherwise

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { getRecipeInstructions } from '@/lib/spoonacular';
import { verifyBearer } from '@/lib/verifyToken';

export async function GET(request: NextRequest) {
    // Verify bearer token for authentication
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    try {
    await verifyBearer(authHeader ?? undefined);
    } catch (err) {
        return errorResponse(401, "Unauthorized");
    }
    const searchParams = request.nextUrl.searchParams;
    const idParam = searchParams.get('id');
    if (!idParam) {
        return errorResponse(400, 'Missing id parameter');
    }
    try {
        const id = parseInt(idParam, 10);
        const instructions = await getRecipeInstructions(id);
        return NextResponse.json({ instructions });
    }
    catch (error) {
        return handleRouteError(error, 'Failed to fetch recipe instructions');
    }
}
