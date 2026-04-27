// AddToCollectionDialog.tsx
// Dialog to add or remove a recipe from shared collections
// Exports useAddToCollection hook for controlling dialog open/close state
//
// Features:
// - Shows all shared collections
// - Pre-selects collections that already contain the recipe
// - Allows user to add the recipe to new collections (by checking)
// - Allows user to remove the recipe from collections (by unchecking)
// - Submits all changes in one action

"use client";

import { CheckCircle2, FolderHeart, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authedFetch } from "@/lib/authedFetch";

type Recipe = { id: number; title: string; image?: string | null };
type Collection = {
  id: string;
  name: string;
  recipes?: { recipeId: number }[];
};

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

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const aSorted = [...a].sort();
  const bSorted = [...b].sort();
  return aSorted.every((id, i) => id === bSorted[i]);
}

export default function AddToCollectionDialog({
  isOpen,
  onOpenChange,
  recipe,
}: AddToCollectionDialogProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialSelectedIds, setInitialSelectedIds] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Reset status when dialog opens/closes or selection changes
  useEffect(() => {
    if (isOpen) setStatus(null);
    if (!isOpen) {
      setSelectedIds([]);
      setInitialSelectedIds([]);
    }
  }, [isOpen]);

  // When collections or recipe changes, pre-select collections that already have the recipe
  useEffect(() => {
    if (!recipe || !collections.length) return;
    const alreadyIn = collections
      .filter((c) => c.recipes?.some((r) => r.recipeId === recipe.id))
      .map((c) => c.id);
    setSelectedIds(alreadyIn);
    setInitialSelectedIds(alreadyIn);
  }, [collections, recipe]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const load = async () => {
      setIsLoadingCollections(true);
      try {
        const res = await authedFetch("/api/shared-collections");
        if (res.ok) {
          const data = await res.json();
          const list = data.collections || [];
          if (!cancelled) {
            setCollections(list);
          }
        } else if (!cancelled) {
          setStatus({ type: "error", message: "Unable to load collections. Please try again." });
        }
      } catch (err) {
        console.error("Error loading collections:", err);
        if (!cancelled) {
          setStatus({ type: "error", message: "Unable to load collections. Please try again." });
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
    if (!recipe) return;
    setIsAdding(true);
    setStatus(null);
    let successCount = 0;
    let errorCount = 0;
    const errorMessages: string[] = [];

    // Add to newly selected collections
    const toAdd = selectedIds.filter((id) => !initialSelectedIds.includes(id));
    // Remove from collections that were initially selected but are now unselected
    const toRemove = initialSelectedIds.filter((id) => !selectedIds.includes(id));

    for (const id of toAdd) {
      try {
        const res = await authedFetch(`/api/shared-collections/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "addRecipe",
            recipeId: recipe.id,
            recipeName: recipe.title,
            recipeImage: recipe.image || null,
          }),
        });
        if (res.ok) {
          successCount++;
        } else {
          errorCount++;
          const data = await res.json().catch(() => ({}));
          const msg = data?.error?.message || data?.message || "Failed to add recipe to collection";
          errorMessages.push(typeof msg === "string" ? msg : "Failed to add recipe");
        }
      } catch (_err) {
        errorCount++;
        errorMessages.push("Something went wrong. Please try again.");
      }
    }

    for (const id of toRemove) {
      try {
        const res = await authedFetch(`/api/shared-collections/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "removeRecipe",
            recipeId: recipe.id,
          }),
        });
        if (res.ok) {
          successCount++;
        } else {
          errorCount++;
          const data = await res.json().catch(() => ({}));
          const msg =
            data?.error?.message || data?.message || "Failed to remove recipe from collection";
          errorMessages.push(typeof msg === "string" ? msg : "Failed to remove recipe");
        }
      } catch (_err) {
        errorCount++;
        errorMessages.push("Something went wrong. Please try again.");
      }
    }

    if (successCount > 0) {
      let msg = "";
      if (toAdd.length > 0) {
        const names = collections
          .filter((c) => toAdd.includes(c.id))
          .map((c) => c.name)
          .join(", ");
        msg += `Added "${recipe.title}" to ${names}. `;
      }
      if (toRemove.length > 0) {
        const names = collections
          .filter((c) => toRemove.includes(c.id))
          .map((c) => c.name)
          .join(", ");
        msg += `Removed "${recipe.title}" from ${names}.`;
      }
      setStatus({ type: "success", message: msg.trim() });
      setTimeout(() => onOpenChange(false), 1500);
    } else if (errorCount > 0) {
      setStatus({ type: "error", message: errorMessages.join("; ") });
    }
    setIsAdding(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add or Remove from Collections</DialogTitle>
          <DialogDescription>
            Check to add, uncheck to remove this recipe from your shared collections.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {/* Status message */}
          {status && (
            <div
              className={`flex items-center gap-2 px-4 py-3 rounded-xl mb-3 text-sm font-medium ${
                status.type === "success"
                  ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
              }`}
            >
              {status.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 flex-shrink-0" />
              )}
              {status.message}
            </div>
          )}

          {isLoadingCollections ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading collections...</p>
          ) : collections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No collections yet. Create one from the Shared Collections page.
            </p>
          ) : (
            <div className="space-y-2">
              {collections.map((c) => {
                const isSelected = selectedIds.includes(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      setSelectedIds((prev) =>
                        prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                      );
                      setStatus(null);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      isSelected ? "border-primary bg-primary/10" : "hover:bg-accent/50"
                    }`}
                  >
                    <FolderHeart className="h-4 w-4 inline-block mr-2 text-muted-foreground" />
                    {c.name}
                    {isSelected && (
                      <CheckCircle2 className="h-4 w-4 inline-block ml-2 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-full"
            disabled={arraysEqual(selectedIds, initialSelectedIds) || isAdding}
            onClick={handleAdd}
          >
            {isAdding ? "Adding..." : "Add to Collection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
