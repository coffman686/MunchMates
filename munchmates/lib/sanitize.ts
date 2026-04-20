// Shared input-sanitization helpers for API routes.

/**
 * Coerce to string, trim, and cap at maxLength.
 * Returns "" when the input is null, undefined, or whitespace.
 */
export function sanitizeString(value: unknown, maxLength: number): string {
    return String(value ?? "").trim().slice(0, maxLength);
}

/**
 * Like sanitizeString but returns null for empty/missing input —
 * convenient for nullable DB columns.
 */
export function sanitizeOptionalString(value: unknown, maxLength: number): string | null {
    const trimmed = sanitizeString(value, maxLength);
    return trimmed || null;
}

/**
 * Parse a positive integer from any input. Returns null if the value
 * is missing, non-finite, zero, or negative. Truncates fractions.
 */
export function parsePositiveInt(value: unknown): number | null {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}
