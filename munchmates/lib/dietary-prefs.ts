'use client';

import { authedFetch } from '@/lib/authedFetch';

export type DietaryPrefs = {
    diets: string[];
    intolerances: string[];
};

let cache: DietaryPrefs = { diets: [], intolerances: [] };
let hydratePromise: Promise<DietaryPrefs> | null = null;
let hydrated = false;

export async function ensureDietaryPrefsLoaded(): Promise<DietaryPrefs> {
    if (hydratePromise) return hydratePromise;
    hydratePromise = (async () => {
        try {
            const res = await authedFetch('/api/profile');
            if (!res.ok) {
                hydratePromise = null;
                return cache;
            }
            const data = await res.json();
            cache = {
                diets: Array.isArray(data.diets) ? data.diets : [],
                intolerances: Array.isArray(data.intolerances) ? data.intolerances : [],
            };
            hydrated = true;
        } catch {
            hydratePromise = null;
        }
        return cache;
    })();
    return hydratePromise;
}

export function isDietaryPrefsHydrated(): boolean {
    return hydrated;
}

export function getDietaryPrefs(): DietaryPrefs {
    return cache;
}

export function getDiets(): string {
    return cache.diets.join(',');
}

export function getIntolerances(): string {
    return cache.intolerances.join(',');
}

export function setDietaryPrefs(prefs: DietaryPrefs): void {
    cache = { diets: [...prefs.diets], intolerances: [...prefs.intolerances] };
    hydrated = true;
}

export function resetDietaryPrefs(): void {
    cache = { diets: [], intolerances: [] };
    hydratePromise = null;
    hydrated = false;
}
