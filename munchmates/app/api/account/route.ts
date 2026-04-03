// app/api/account/route.ts
// this routing directly concerns how we will handle a user's account deletion,
// and verifying the token we are given. Also helps to show error codes if keycloak
// acts up
import { NextRequest, NextResponse } from "next/server";
import { errorResponse, handleRouteError } from "@/lib/apiErrors";
import { verifyBearer } from "@/lib/verifyToken";
import { deleteUserById } from "@/lib/keycloakAdmin";
import { rateLimiter } from "@/lib/rateLimiter";

export async function DELETE(req: NextRequest) {
    // Rate limiting by IP address
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
    const { success } = await rateLimiter.limit(ip);
    if (!success) {
        return errorResponse(429, "Too Many Requests");
    }

    try {
        const claims = await verifyBearer(
            req.headers.get("authorization") || undefined
        );

        if (!claims?.sub) {
            return errorResponse(400, "No user id (sub) in token");
        }

        // If you want to also remove local profile data, you can move the
        // `profiles` Map into a shared module and delete here as well.

        await deleteUserById(claims.sub);

        return NextResponse.json({ ok: true });
    } catch (error) {
        return handleRouteError(error, "Error deleting Keycloak account");
    }
}
