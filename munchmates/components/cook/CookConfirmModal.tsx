// CookConfirmModal.tsx
// Modal to confirm pantry deductions when cooking a recipe
// Shows ingredient matching status and allows user to toggle which items to deduct

'use client';

import { useState, useEffect, useCallback } from 'react';
import { authedFetch } from '@/lib/authedFetch';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertTriangle, ChefHat, Loader2, Check, Minus } from 'lucide-react';
import { formatAmount } from '@/lib/unit-conversion';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface RecipeForCook {
    id: number;
    title: string;
    servings?: number;
    extendedIngredients?: Array<{
        id: number;
        name: string;
        amount: number;
        unit: string;
        original: string;
    }>;
}

interface MatchResult {
    ingredientIndex: number;
    ingredientName: string;
    ingredientAmount: number;
    ingredientUnit: string;
    pantryItem: {
        id: number;
        name: string;
        amount: number | null;
        unit: string;
    } | null;
    status: 'matched' | 'partial' | 'unmatched';
}

interface DeductionRow {
    match: MatchResult;
    enabled: boolean;
    scaledAmount: number;
    scaledUnit: string;
}

export interface CookConfirmModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    recipe: RecipeForCook | null;
    cookServings: number;
    onCooked?: () => void;
}

export function useCookModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [recipe, setRecipe] = useState<RecipeForCook | null>(null);
    const [cookServings, setCookServings] = useState(1);

    const openModal = useCallback((r: RecipeForCook, servings?: number) => {
        setRecipe(r);
        setCookServings(servings ?? r.servings ?? 1);
        setIsOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setIsOpen(false);
    }, []);

    return { isOpen, recipe, cookServings, openModal, closeModal, setIsOpen, setCookServings };
}

export default function CookConfirmModal({
    isOpen,
    onOpenChange,
    recipe,
    cookServings,
    onCooked,
}: CookConfirmModalProps) {
    const [rows, setRows] = useState<DeductionRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeducting, setIsDeducting] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setStatus(null);
            setRows([]);
            return;
        }
        if (!recipe?.extendedIngredients?.length) return;

        const fetchMatches = async () => {
            setIsLoading(true);
            try {
                const recipeServings = recipe.servings || 1;
                const scale = cookServings / recipeServings;

                const scaledIngredients = recipe.extendedIngredients!.map((ing) => ({
                    name: ing.name,
                    amount: ing.amount * scale,
                    unit: ing.unit,
                }));

                const res = await authedFetch('/api/pantry/match', {
                    method: 'POST',
                    body: JSON.stringify({ ingredients: scaledIngredients }),
                });

                if (res.ok) {
                    const data = await res.json();
                    const matches: MatchResult[] = data.matches || [];
                    const statusOrder = { matched: 0, partial: 1, unmatched: 2 };
                    const sorted = [...matches].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
                    setRows(
                        sorted.map((match) => ({
                            match,
                            enabled: match.status !== 'unmatched',
                            scaledAmount: match.ingredientAmount,
                            scaledUnit: match.ingredientUnit,
                        }))
                    );
                }
            } catch (err) {
                console.error('Error fetching pantry matches:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMatches();
    }, [isOpen, recipe, cookServings]);

    const toggleRow = (index: number) => {
        setRows((prev) =>
            prev.map((row, i) =>
                i === index ? { ...row, enabled: !row.enabled } : row
            )
        );
    };

    const handleDeduct = async () => {
        setIsDeducting(true);
        setStatus(null);

        const deductions = rows
            .filter((row) => row.enabled && row.match.pantryItem)
            .map((row) => ({
                pantryItemId: row.match.pantryItem!.id,
                amount: row.scaledAmount,
                unit: row.scaledUnit,
            }));

        if (deductions.length === 0) {
            setStatus({ type: 'success', message: 'Marked as cooked (no pantry items to deduct)' });
            setIsDeducting(false);
            onCooked?.();
            setTimeout(() => onOpenChange(false), 1500);
            return;
        }

        try {
            const res = await authedFetch('/api/pantry/deduct', {
                method: 'POST',
                body: JSON.stringify({ deductions }),
            });

            if (res.ok) {
                const data = await res.json();
                const removed = data.results.filter((r: { action: string }) => r.action === 'removed').length;
                const updated = data.results.filter((r: { action: string }) => r.action === 'updated').length;
                const parts = [];
                if (updated > 0) parts.push(`${updated} item${updated > 1 ? 's' : ''} updated`);
                if (removed > 0) parts.push(`${removed} item${removed > 1 ? 's' : ''} used up`);
                setStatus({ type: 'success', message: parts.join(', ') || 'Pantry updated!' });
                onCooked?.();
                setTimeout(() => onOpenChange(false), 1500);
            } else {
                const data = await res.json().catch(() => ({}));
                setStatus({
                    type: 'error',
                    message: data?.error?.message || 'Failed to deduct from pantry',
                });
            }
        } catch (err) {
            console.error('Error deducting from pantry:', err);
            setStatus({ type: 'error', message: 'Something went wrong. Please try again.' });
        } finally {
            setIsDeducting(false);
        }
    };

    const matchedCount = rows.filter((r) => r.match.status === 'matched').length;
    const partialCount = rows.filter((r) => r.match.status === 'partial').length;
    const unmatchedCount = rows.filter((r) => r.match.status === 'unmatched').length;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ChefHat className="h-5 w-5" />
                        Cook {recipe?.title}
                    </DialogTitle>
                    <DialogDescription>
                        Cooking {cookServings} serving{cookServings !== 1 ? 's' : ''}.
                        Review ingredients to deduct from your pantry.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2 space-y-3">
                    {/* Status message */}
                    {status && (
                        <div
                            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
                                status.type === 'success'
                                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                            }`}
                        >
                            {status.type === 'success' ? (
                                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                            ) : (
                                <XCircle className="h-4 w-4 flex-shrink-0" />
                            )}
                            {status.message}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No ingredients to match.
                        </p>
                    ) : (
                        <>
                            {/* Summary chips */}
                            <div className="flex items-center gap-2 text-xs">
                                {matchedCount > 0 && (
                                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                                        {matchedCount} in pantry
                                    </span>
                                )}
                                {partialCount > 0 && (
                                    <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                                        {partialCount} low
                                    </span>
                                )}
                                {unmatchedCount > 0 && (
                                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                                        {unmatchedCount} missing
                                    </span>
                                )}
                            </div>

                            {/* Ingredient rows */}
                            <div className="space-y-1">
                                {rows.map((row, index) => {
                                    const statusColor =
                                        row.match.status === 'matched'
                                            ? 'border-green-200 bg-green-50/50'
                                            : row.match.status === 'partial'
                                            ? 'border-amber-200 bg-amber-50/50'
                                            : 'border-gray-200 bg-gray-50/50';

                                    const StatusIcon =
                                        row.match.status === 'matched'
                                            ? Check
                                            : row.match.status === 'partial'
                                            ? AlertTriangle
                                            : Minus;

                                    const statusIconColor =
                                        row.match.status === 'matched'
                                            ? 'text-green-600'
                                            : row.match.status === 'partial'
                                            ? 'text-amber-600'
                                            : 'text-gray-400';

                                    return (
                                        <button
                                            key={index}
                                            onClick={() => {
                                                if (row.match.pantryItem) toggleRow(index);
                                            }}
                                            disabled={!row.match.pantryItem}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${statusColor} ${
                                                row.enabled && row.match.pantryItem
                                                    ? 'opacity-100'
                                                    : 'opacity-50'
                                            }`}
                                        >
                                            {/* Checkbox */}
                                            <div
                                                className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                                                    row.enabled && row.match.pantryItem
                                                        ? 'bg-primary border-primary'
                                                        : 'border-muted-foreground/30'
                                                }`}
                                            >
                                                {row.enabled && row.match.pantryItem && (
                                                    <Check className="h-3 w-3 text-primary-foreground" />
                                                )}
                                            </div>

                                            {/* Status icon */}
                                            <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${statusIconColor}`} />

                                            {/* Name + amount */}
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm font-medium truncate block">
                                                    {row.match.ingredientName}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {row.scaledAmount > 0
                                                        ? `${formatAmount(row.scaledAmount)} ${row.scaledUnit}`.trim()
                                                        : ''}
                                                    {row.match.pantryItem && row.match.pantryItem.amount !== null && (
                                                        <span className="ml-1 text-muted-foreground/60">
                                                            (have: {formatAmount(row.match.pantryItem.amount)} {row.match.pantryItem.unit})
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        className="rounded-full gap-1.5"
                        onClick={handleDeduct}
                        disabled={isDeducting || isLoading}
                    >
                        {isDeducting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <ChefHat className="h-4 w-4" />
                        )}
                        {isDeducting ? 'Cooking...' : 'I Cooked This'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
