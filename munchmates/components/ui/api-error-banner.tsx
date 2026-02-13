/*
Artifact Name: api-error-banner.tsx
Description: Reusable UI banner for displaying API failures and retry action.
Programmer: Landon Bever
Date Created: 02-12-2026
Date Revised: 02-12-2026 - Initial implementation.

Preconditions:
- "message" must be a display-safe non-empty string.
- "onRetry" should be a side-effect-safe callback.
- "isValidation" should be boolean when provided.
- Unacceptable input: sensitive/internal-only text in `message`.

Postconditions:
- Returns JSX for an accessible alert region containing the error message.
- If "onRetry" is provided, renders a retry button bound to that callback.
- Validation errors render amber styling; other errors render red styling.

Error / Exception Conditions:
- Errors may occur only if parent passes invalid props not aligned with TypeScript contract.

Side Effects: None

Invariants:
- Message text is always rendered.

Known Faults: None

*/

import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApiErrorBannerProps { // Define prop contract for the error banner component
    message: string;
    onRetry?: () => void;
    onDismiss?: () => void;
    isValidation?: boolean;
}

export default function ApiErrorBanner({ message, onRetry, onDismiss, isValidation = false }: ApiErrorBannerProps) { // Render standardized error banner
    const containerClasses = isValidation
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-red-300 bg-red-50 text-red-900";

    return ( // Return accessible alert UI
        <div className={`rounded-md border p-3 ${containerClasses}`} role="alert" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p className="text-sm font-medium">{message}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {onRetry && !isValidation ? ( // Hide retry for validation errors since form state hasn't changed
                        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                            Retry
                        </Button>
                    ) : null}
                    {onDismiss ? ( // Render dismiss button when callback exists
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onDismiss}>
                            <X className="h-4 w-4" />
                        </Button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
