// AddToCollectionDialog.tsx
// Dialog to add a recipe to an existing shared collection
// Exports useAddToCollection hook for controlling dialog open/close state

'use client';

import { useState, useEffect, useCallback } from 'react';
import { authedFetch } from '@/lib/authedFetch';
import { Button } from '@/components/ui/button';
import { FolderHeart, CheckCircle2, XCircle } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type Recipe = { id: number; title: string; image?: string | null };
type Collection = { id: string; name: string };

let cachedCollections: Collection[] | null = null;

export function useAddToCollection() {
    const [isOpen, setIsOpen] = useState(false);
    const [recipe, setRecipe] = useState<Recipe | null>(null);

    const openDialog = useCallback((r: Recipe) => {
        setRecipe(r);
        setIsOpen(true);
    }, []);

    const closeDialog = useCallback(() => {
        setIsOpen(false);
    }, []);

    return { isOpen, recipe, openDialog, closeDialog, setIsOpen };
}

interface AddToCollectionDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    recipe: { id: number; title: string; image?: string | null } | null;
}

export default function AddToCollectionDialog({ isOpen, onOpenChange, recipe }: AddToCollectionDialogProps) {
    const [collections, setCollections] = useState<Collection[]>(cachedCollections ?? []);
    const [selectedId, setSelectedId] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isLoadingCollections, setIsLoadingCollections] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Reset status when dialog opens/closes or selection changes
    useEffect(() => {
        if (isOpen) setStatus(null);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        if (cachedCollections !== null) {
            setCollections(cachedCollections);
            return;
        }

        let cancelled = false;
        const load = async () => {
            setIsLoadingCollections(true);
            try {
                const res = await authedFetch('/api/shared-collections');
                if (res.ok) {
                    const data = await res.json();
                    const list = data.collections || [];
                    if (!cancelled) {
                        setCollections(list);
                    }

                    // Cache only non-empty results so we can re-check if user creates their first collection.
                    cachedCollections = list.length > 0 ? list : null;
                } else if (!cancelled) {
                    setStatus({ type: 'error', message: 'Unable to load collections. Please try again.' });
                }
            } catch (err) {
                console.error('Error loading collections:', err);
                if (!cancelled) {
                    setStatus({ type: 'error', message: 'Unable to load collections. Please try again.' });
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingCollections(false);
                }
            }
        };
        load();

        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    const handleAdd = async () => {
        if (!recipe || !selectedId) return;
        setIsAdding(true);
        setStatus(null);
        try {
            const res = await authedFetch(`/api/shared-collections/${selectedId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'addRecipe',
                    recipeId: recipe.id,
                    recipeName: recipe.title,
                    recipeImage: recipe.image || null,
                }),
            });
            if (res.ok) {
                const collectionName = collections.find(c => c.id === selectedId)?.name || 'collection';
                setStatus({ type: 'success', message: `Added "${recipe.title}" to ${collectionName}` });
                setSelectedId('');
                // Auto-close after a short delay so the user sees the message
                setTimeout(() => onOpenChange(false), 1500);
            } else {
                const data = await res.json().catch(() => ({}));
                const msg = data?.error?.message || data?.message || 'Failed to add recipe to collection';
                setStatus({ type: 'error', message: typeof msg === 'string' ? msg : 'Failed to add recipe' });
            }
        } catch (err) {
            console.error('Error adding to collection:', err);
            setStatus({ type: 'error', message: 'Something went wrong. Please try again.' });
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-2xl">
                <DialogHeader>
                    <DialogTitle>Add to Collection</DialogTitle>
                    <DialogDescription>
                        Choose a shared collection to add this recipe to.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {/* Status message */}
                    {status && (
                        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl mb-3 text-sm font-medium ${
                            status.type === 'success'
                                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                            {status.type === 'success'
                                ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                                : <XCircle className="h-4 w-4 flex-shrink-0" />
                            }
                            {status.message}
                        </div>
                    )}

                    {isLoadingCollections ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            Loading collections...
                        </p>
                    ) : collections.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No collections yet. Create one from the Shared Collections page.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {collections.map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => { setSelectedId(c.id); setStatus(null); }}
                                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                                        selectedId === c.id
                                            ? 'border-primary bg-primary/10'
                                            : 'hover:bg-accent/50'
                                    }`}
                                >
                                    <FolderHeart className="h-4 w-4 inline-block mr-2 text-muted-foreground" />
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        className="rounded-full"
                        disabled={!selectedId || isAdding}
                        onClick={handleAdd}
                    >
                        {isAdding ? 'Adding...' : 'Add to Collection'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
