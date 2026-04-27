// lib/types/api.ts
// Contains error response codes for api requests

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DB_ERROR"
  | "EXTERNAL_API_ERROR"
  | "INTERNAL_ERROR"
  | "UNKNOWN_ERROR";
