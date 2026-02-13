/*
Artifact Name: apiClient.ts
Description: Frontend helpers for parsing API failures and exposing client errors.
Programmer: Landon Bever
Date Created: 02-12-2026
Date Revised: 02-12-2026 - Initial implementation.

Preconditions:
- "response" must be a Fetch API Response instance.
- "fallbackMessage" values should be display-safe strings.
- Error payloads are expected to follow standardized backend shape when available.
- Unacceptable input: non-Response objects passed as "response", or sensitive fallback strings.

Postconditions:
- "toApiClientError()" returns an "ApiClientError" with message/status/code.
- "assertOk()" returns original "Response" when successful; throws "ApiClientError" otherwise.
- "getErrorMessage()" returns a user-safe message string.
- "isValidationError()" returns true only for "VALIDATION_ERROR" codes.

Error / Exception Conditions:
- "assertOk()" throws on non-2xx responses.

Side Effects: None

Invariants:
- Returned/raised error objects include a status number and stable code string.
- Unknown payload shapes degrade to fallback message and "UNKNOWN_ERROR".

Known Faults: None

*/

export type ApiErrorCode = // Declare API error identifiers
    | "VALIDATION_ERROR"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "DB_ERROR"
    | "EXTERNAL_API_ERROR"
    | "INTERNAL_ERROR"
    | "UNKNOWN_ERROR";

export class ApiClientError extends Error { // Typed error wrapper consumed by frontend flows
    status: number;
    code: ApiErrorCode;

    constructor(message: string, status: number, code: ApiErrorCode) {
        super(message);
        this.name = "ApiClientError";
        this.status = status;
        this.code = code;
    }
}

function parseLegacyError(payload: unknown): string | null { // Support older payload format
    if (!payload || typeof payload !== "object") return null;

    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string") return value;

    return null;
}

export async function toApiClientError( // Convert failed fetch response into ApiClientError
    response: Response,
    fallbackMessage = "Request failed"
): Promise<ApiClientError> {
    let status = response.status || 500;
    let code: ApiErrorCode = "UNKNOWN_ERROR";
    let message = fallbackMessage;

    try { // Attempt JSON body parsing
        const body = (await response.json()) as {
            error?: { status?: number; code?: ApiErrorCode; message?: string };
        };

        if (body?.error && typeof body.error === "object") {
            status = typeof body.error.status === "number" ? body.error.status : status;
            code = typeof body.error.code === "string" ? body.error.code : code;
            message = typeof body.error.message === "string" ? body.error.message : message;
        } else {
            const legacyError = parseLegacyError(body);
            if (legacyError) {
                message = legacyError;
            }
        }
    } catch {
        // Non-JSON responses intentionally fall back to defaults
    }

    return new ApiClientError(message, status, code);
}

export async function assertOk(response: Response, fallbackMessage?: string): Promise<Response> { // Guard helper that throws on non-OK responses
    if (response.ok) return response;
    throw await toApiClientError(response, fallbackMessage);
}

export function getErrorMessage(error: unknown, fallbackMessage: string): string { // Extract display-safe message from unknown errors
    if (error instanceof ApiClientError) {
        return error.message;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallbackMessage;
}

export function isValidationError(error: unknown): boolean { // Predicate for validation-specific UI states
    return error instanceof ApiClientError && error.code === "VALIDATION_ERROR";
}
