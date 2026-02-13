/*
Artifact Name: apiErrors.ts
Description: Shared server-side API error model, serializer, and mapping helpers for Next.js route handlers.
Programmer: Landon Bever
Date Created: 02-12-2026
Date Revised: 02-12-2026 - Initial implementation.

Preconditions:
- "status" values should be valid HTTP status numbers.
- "message" values should be user-safe strings.
- "code" values must be one of the "ApiErrorCode" values.
- "error" values may be "unknown"; mapper handles known classes and falls back safely.
- "context" should be a short, non-sensitive operation label.
- Unacceptable input: status values outside HTTP semantics, non-string messages, or sensitive messages.

Postconditions:
- "errorResponse()" returns a JSON body.
- "handleRouteError()" returns a safe standardized response.
- Unknown/unhandled failures produce HTTP 500 with code "INTERNAL_ERROR".

Error / Exception Conditions:
- Underlying framework/runtime failures may still throw.
- Prisma error instances are mapped when available.

Side Effects: None

Invariants:
- All responses from this module have "ok: false".
- All responses include "error.status", "error.code", and "error.message".

Known Faults: None

 */

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export type ApiErrorCode = // Declare API error identifiers returned to the frontend
    | "VALIDATION_ERROR"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "DB_ERROR"
    | "EXTERNAL_API_ERROR"
    | "INTERNAL_ERROR";

export interface ApiErrorPayload { // Declare server error payload shape
    ok: false;
    error: {
        status: number;
        code: ApiErrorCode;
        message: string;
    };
}

export class ApiError extends Error { // Custom error type
    status: number;
    code: ApiErrorCode;

    constructor(status: number, code: ApiErrorCode, message: string) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = "ApiError";
    }
}

function statusToDefaultCode(status: number): ApiErrorCode { // Convert status to default code when caller omits explicit code
    switch (status) {
        case 400:
            return "VALIDATION_ERROR";
        case 401:
            return "UNAUTHORIZED";
        case 403:
            return "FORBIDDEN";
        case 404:
            return "NOT_FOUND";
        case 429:
            return "EXTERNAL_API_ERROR";
        case 409:
            return "CONFLICT";
        default: // Handle all remaining statuses
            if (status >= 500) return "INTERNAL_ERROR";
            return "VALIDATION_ERROR";
    }
}

export function errorResponse( // Create standardized JSON response for known errors
    status: number,
    message: string,
    code: ApiErrorCode = statusToDefaultCode(status)
) {
    const payload: ApiErrorPayload = { // Build error payload object
        ok: false,
        error: {
            status,
            code,
            message,
        },
    };

    return NextResponse.json(payload, { status });
}

function toApiError(error: unknown): ApiError | null { // Try to map unknown thrown values into typed ApiError
    if (error instanceof ApiError) return error;

    if (error instanceof Error && error.message === "no token") {
        return new ApiError(401, "UNAUTHORIZED", "Unauthorized");
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) { // Map known Prisma request errors
        if (error.code === "P2025") {
            return new ApiError(404, "NOT_FOUND", "Resource not found");
        }

        if (error.code === "P2002") {
            return new ApiError(409, "CONFLICT", "Resource already exists");
        }

        return new ApiError(500, "DB_ERROR", "Database operation failed"); // Convert other known DB request errors to DB_ERROR
    }

    if (error instanceof Prisma.PrismaClientValidationError) { // Map Prisma validation failures
        return new ApiError(400, "VALIDATION_ERROR", "Invalid request data");
    }

    return null;
}

function formatLogError(error: unknown) { // Normalize unknown errors into structured object.
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }

    return { raw: error };
}

export function handleRouteError(error: unknown, context: string) { // Main route-level adapter for thrown errors
    const knownError = toApiError(error);
    if (knownError) {
        if (knownError.status >= 500) {
            console.error(`[API_ERROR] ${context}`, formatLogError(error));
        }
        return errorResponse(knownError.status, knownError.message, knownError.code);
    }

    console.error(`[API_ERROR] ${context}`, formatLogError(error));
    return errorResponse(500, "Internal server error", "INTERNAL_ERROR");
}
