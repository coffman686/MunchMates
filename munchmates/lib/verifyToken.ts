// lib/verifyToken.ts
// Server-side token verification using jose and Keycloak JWKS

import 'server-only';
import * as jose from 'jose';
import { ApiError } from '@/lib/apiErrors';

const issuer   = process.env.KEYCLOAK_ISSUER!;                  // e.g. http://localhost:8080/realms/dev
const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID!;   // your SPA clientId
const JWKS = jose.createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));

export async function verifyBearer(authHeader?: string) {
    if (!authHeader?.startsWith('Bearer ')) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }
    const token = authHeader.slice(7);

    // Verify signature, issuer, time-based claims (with a small clock skew)
    const { payload } = await jose.jwtVerify(token, JWKS, {
        issuer,
        clockTolerance: 60,        // 60s skew tolerance helps in dev
        // (we’ll validate audience manually below to handle array/azp cases)
    });

    // Manual audience/azp check that works with Keycloak variants
    const aud = payload.aud;
    const azp = (payload as any).azp; // authorized party

    const audOk =
        (typeof aud === 'string' && aud === clientId) ||
        (Array.isArray(aud) && aud.includes(clientId)) ||
        (typeof azp === 'string' && azp === clientId);

    if (!audOk) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const subject = typeof payload.sub === 'string' ? payload.sub.trim() : '';
    if (!subject) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    return { ...payload, sub: subject } as any;
}

export const hasRole = (p: any, role: string) =>
    Array.isArray(p?.realm_access?.roles) && p.realm_access.roles.includes(role);
