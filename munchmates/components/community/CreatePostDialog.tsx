// CreatePostDialog.tsx
// Dialog for creating a new community post
// Features:
// - Caption textarea with a 2000-character cap
// - Optional image upload via `/api/upload` (reuses recipe-image storage)
// - Optional recipe reference picker that merges the user's saved recipes
//   with their custom recipes, labeling each as "Spoonacular" or "Custom"
//   based on the authoritative CustomRecipe table (not an ID range)
// - Optional 1-5 star rating, shown only when a recipe is attached
// - On submit, POSTs to `/api/posts` and returns the created post to the
//   parent via `onPostCreated` so it can prepend to the feed

"use client";

import { Bookmark, ChefHat, ImagePlus, Star, Utensils, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { ensureToken, waitForInit } from "@/lib/keycloak";

export type PickableRecipe = {
  recipeId: number;
  recipeName: string;
  recipeImage: string | null;
  recipeType: "spoonacular" | "custom";
};

export type NewPost = {
  id: string;
  caption: string;
  image: string | null;
  recipeId: number | null;
  recipeType: string | null;
  recipeName: string | null;
  recipeImage: string | null;
  rating: number | null;
  createdAt: string;
  author: { id: string; name: string; username: string };
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreated: (post: NewPost) => void;
}

export default function CreatePostDialog({ isOpen, onOpenChange, onPostCreated }: Props) {
  const [caption, setCaption] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<PickableRecipe | null>(null);
  const [rating, setRating] = useState(0);

  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [recipes, setRecipes] = useState<PickableRecipe[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setCaption("");
    setImageFile(null);
    setImagePreview(null);
    setSelectedRecipe(null);
    setRating(0);
    setShowRecipePicker(false);
    setRecipeSearch("");
    setError(null);
  }, []);

  useEffect(() => {
    if (!isOpen) resetForm();
  }, [isOpen, resetForm]);

  // Load recipe options only when the user opens the picker
  useEffect(() => {
    if (!showRecipePicker || recipes.length > 0) return;
    let cancelled = false;
    const load = async () => {
      setIsLoadingRecipes(true);
      try {
        const [savedRes, customRes] = await Promise.all([
          authedFetch("/api/recipes/saved"),
          authedFetch("/api/recipes/create"),
        ]);

        // Authoritative set of custom recipe IDs from the CustomRecipe table.
        // A saved recipe is "custom" iff its ID is present here; otherwise
        // it's a Spoonacular ID. (Spoonacular IDs regularly exceed 100000,
        // so we cannot rely on the numeric range alone.)
        const customIds = new Set<number>();
        const customList: PickableRecipe[] = [];

        if (customRes.ok) {
          const data = await customRes.json();
          for (const r of data.recipes || []) {
            customIds.add(r.id);
            customList.push({
              recipeId: r.id,
              recipeName: r.title,
              recipeImage: r.image ?? null,
              recipeType: "custom",
            });
          }
        }

        const savedList: PickableRecipe[] = [];
        if (savedRes.ok) {
          const data = await savedRes.json();
          for (const r of data.recipes || []) {
            savedList.push({
              recipeId: r.recipeId,
              recipeName: r.recipeName,
              recipeImage: r.recipeImage ?? null,
              recipeType: customIds.has(r.recipeId) ? "custom" : "spoonacular",
            });
          }
        }

        const merged = new Map<string, PickableRecipe>();
        for (const r of [...customList, ...savedList]) {
          const key = `${r.recipeType}:${r.recipeId}`;
          if (!merged.has(key)) merged.set(key, r);
        }

        if (!cancelled) setRecipes(Array.from(merged.values()));
      } catch (err) {
        console.error("Error loading recipes:", err);
      } finally {
        if (!cancelled) setIsLoadingRecipes(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [showRecipePicker, recipes.length]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5MB or smaller");
      return;
    }
    setError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    const trimmed = caption.trim();
    if (!trimmed) {
      setError("Please write a caption");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        await waitForInit();
        const token = await ensureToken();
        const formData = new FormData();
        formData.append("file", imageFile);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => null);
          throw new Error(data?.error || "Failed to upload image");
        }
        const data = await uploadRes.json();
        imageUrl = data.url;
      }

      const payload: Record<string, unknown> = {
        caption: trimmed,
        image: imageUrl,
      };
      if (selectedRecipe) {
        payload.recipeId = selectedRecipe.recipeId;
        payload.recipeType = selectedRecipe.recipeType;
        payload.recipeName = selectedRecipe.recipeName;
        payload.recipeImage = selectedRecipe.recipeImage;
        if (rating > 0) payload.rating = rating;
      }

      const res = await authedFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || "Failed to create post");
      }

      const data = await res.json();
      onPostCreated(data.post);
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRecipes = recipeSearch.trim()
    ? recipes.filter((r) => r.recipeName.toLowerCase().includes(recipeSearch.toLowerCase()))
    : recipes;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a post</DialogTitle>
          <DialogDescription>
            Share a recipe, a photo, or a thought with the MunchMates community.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Caption */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground block">
              Caption
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="What are you cooking today?"
                rows={4}
                maxLength={2000}
                className="mt-1.5 w-full rounded-xl border border-border/50 bg-muted/30 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <p className="text-[11px] text-muted-foreground text-right mt-1">
              {caption.length}/2000
            </p>
          </div>

          {/* Image */}
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground block">
              Photo (optional)
              {imagePreview ? (
                <div className="mt-1.5 relative rounded-xl overflow-hidden bg-muted aspect-[16/9]">
                  <Image
                    src={imagePreview}
                    alt="Selected"
                    fill
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 h-8 w-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1.5 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground hover:bg-muted/50 transition"
                >
                  <ImagePlus className="h-5 w-5" />
                  Add a photo
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Recipe */}
          <div>
            <label
              htmlFor="recipe-input"
              className="text-[12px] font-semibold text-muted-foreground mb-1.5 block"
            >
              Attach a recipe (optional)
            </label>
            {selectedRecipe ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/30">
                <div className="h-12 w-12 relative rounded-lg overflow-hidden bg-muted shrink-0">
                  {selectedRecipe.recipeImage ? (
                    <Image
                      src={selectedRecipe.recipeImage}
                      alt=""
                      fill
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Utensils className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">{selectedRecipe.recipeName}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {selectedRecipe.recipeType} recipe
                  </p>
                </div>
                <button
                  id="recipe-input"
                  type="button"
                  onClick={() => {
                    setSelectedRecipe(null);
                    setRating(0);
                  }}
                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : showRecipePicker ? (
              <div className="space-y-2 p-3 rounded-xl border border-border/50 bg-muted/20">
                <input
                  type="text"
                  placeholder="Search your recipes..."
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {isLoadingRecipes ? (
                    <p className="text-sm text-muted-foreground text-center py-3">
                      Loading recipes...
                    </p>
                  ) : filteredRecipes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3">
                      {recipes.length === 0
                        ? "No saved or custom recipes yet."
                        : "No recipes match your search."}
                    </p>
                  ) : (
                    filteredRecipes.map((r) => (
                      <button
                        id="recip-input"
                        key={`${r.recipeType}-${r.recipeId}`}
                        type="button"
                        onClick={() => {
                          setSelectedRecipe(r);
                          setShowRecipePicker(false);
                        }}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/70 text-left"
                      >
                        <div className="h-10 w-10 relative rounded-md overflow-hidden bg-muted shrink-0">
                          {r.recipeImage ? (
                            <Image
                              src={r.recipeImage}
                              alt=""
                              fill
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              {r.recipeType === "custom" ? (
                                <ChefHat className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Bookmark className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate">{r.recipeName}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">
                            {r.recipeType}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecipePicker(false)}
                  className="text-[12px] text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowRecipePicker(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground hover:bg-muted/50 transition"
              >
                <Utensils className="h-5 w-5" />
                Attach a recipe
              </button>
            )}
          </div>

          {/* Rating, only shown when a recipe is attached */}
          {selectedRecipe && (
            <div>
              <label
                htmlFor="rating-input"
                className="text-[12px] font-semibold text-muted-foreground mb-1.5 block"
              >
                Your rating (optional)
              </label>
              <div id="rating-input" className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(rating === n ? 0 : n)}
                    className="transition-transform active:scale-110"
                  >
                    <Star
                      className={`h-7 w-7 ${
                        n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
                      }`}
                    />
                  </button>
                ))}
                {rating > 0 && (
                  <button
                    type="button"
                    onClick={() => setRating(0)}
                    className="ml-2 text-[12px] text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="rounded-full"
            onClick={handleSubmit}
            disabled={isSubmitting || !caption.trim()}
          >
            {isSubmitting ? "Posting..." : "Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
