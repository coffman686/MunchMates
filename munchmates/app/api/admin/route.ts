//munchmates/app/api/admin/route.ts
// Admin route that requires 'admin' role.
// Verifies the bearer token and checks for admin role.

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer, hasRole } from '@/lib/verifyToken';

export async function GET(req: NextRequest) {
    try {
        const claims = await verifyBearer(req.headers.get('authorization') || undefined);
        if (!hasRole(claims, 'admin')) {
            return errorResponse(403, 'Forbidden');
        }
        return NextResponse.json({ secret: 'Admin zone unlocked ✨' });
    } catch (error) {
        return handleRouteError(error, "Error in GET /api/admin");
    }
}
