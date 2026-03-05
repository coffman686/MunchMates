// DraggableRecipeCard
// Recipe card element with support for movement via mouse
// - Allows user to move the card around the page
// - Update serving count for a recipe
// - Allows deletion of recipe

'use client';

import { useDraggable } from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import { MealPlanEntry } from '@/lib/types/meal-plan';
import { GripVertical, X, Minus, Plus, Users, Clock } from 'lucide-react';

interface DraggableRecipeCardProps {
  entry: MealPlanEntry;
  onRemove: () => void;
  onUpdateServings?: (newServings: number) => void;
}

export default function DraggableRecipeCard({
  entry,
  onRemove,
  onUpdateServings,
}: DraggableRecipeCardProps) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
    data: { entry },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const isScaled = entry.originalServings && entry.servings !== entry.originalServings;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => router.push(`/recipes/${entry.recipeId}`)}
      className={`group relative flex items-center gap-2.5 rounded-xl p-2 cursor-pointer transition-all ${
        isDragging
          ? 'shadow-xl opacity-90 z-50 bg-card ring-2 ring-primary/30'
          : 'bg-card shadow-[0_1px_4px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] border border-border/50'
      }`}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded touch-none flex-shrink-0"
        aria-label="Drag to move"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
      </button>

      {/* Thumbnail */}
      {entry.image ? (
        <img
          src={entry.image}
          alt={entry.title}
          className="w-20 h-20 rounded-lg object-cover flex-shrink-0 shadow-sm"
        />
      ) : (
        <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center flex-shrink-0">
          <span className="text-xl">🍽️</span>
        </div>
      )}

      {/* Title + stats */}
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{entry.title}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {onUpdateServings && (
            <div className="flex items-center gap-0.5">
              <button
                className="h-5 w-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  if (entry.servings > 1) onUpdateServings(entry.servings - 1);
                }}
                disabled={entry.servings <= 1}
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className={`text-xs flex items-center gap-0.5 tabular-nums px-0.5 ${isScaled ? 'text-primary font-bold' : 'text-muted-foreground font-medium'}`}>
                <Users className="h-3 w-3" />
                {entry.servings}
              </span>
              <button
                className="h-5 w-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateServings(entry.servings + 1);
                }}
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          )}
          {entry.readyInMinutes != null && entry.readyInMinutes > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {entry.readyInMinutes}m
            </span>
          )}
        </div>
      </div>

      {/* Remove button */}
      <button
        className="h-6 w-6 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex-shrink-0"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        aria-label="Remove recipe"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
