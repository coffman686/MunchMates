// lib/authedFetch.ts
// Authenticated fetch wrapper for MunchMates API calls.
// - Waits for Keycloak initialization before making requests
// - Attaches a Bearer token when the user is authenticated
// - Automatically refreshes near-expiry tokens via `ensureToken`
// - Falls back gracefully with a console warning when unauthenticated

'use client';
import { ensureToken, waitForInit, keycloak } from '@/lib/keycloak';

export async function authedFetch(input: RequestInfo, init: RequestInit = {}) {
    const headers = new Headers(init.headers || {});
    headers.set('Content-Type', 'application/json');

    // Wait for Keycloak init to fully settle (never triggers init itself)
    await waitForInit();

    // validate authentication
    if (keycloak.authenticated) {
        // add token if available
        const token = await ensureToken();
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        } else {
            console.warn('authedFetch: Keycloak authenticated but no token available');
        }
    } else {
        console.warn('authedFetch: Keycloak not authenticated');
    }

    return fetch(input, { ...init, headers });
}
