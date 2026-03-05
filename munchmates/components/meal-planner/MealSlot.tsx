'use client';

import { useDroppable } from '@dnd-kit/core';
import { MealPlanEntry, MealType } from '@/lib/types/meal-plan';
import { Plus } from 'lucide-react';
import DraggableRecipeCard from './DraggableRecipeCard';

interface MealSlotProps {
  dayDate: string;
  mealType: MealType;
  entry?: MealPlanEntry;
  onAddRecipe: () => void;
  onRemoveRecipe: () => void;
  onUpdateServings?: (newServings: number) => void;
}

export default function MealSlot({
  dayDate,
  mealType,
  entry,
  onAddRecipe,
  onRemoveRecipe,
  onUpdateServings,
}: MealSlotProps) {
  const droppableId = `${dayDate}-${mealType}`;

  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { dayDate, mealType },
  });

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl p-1 transition-all ${
          isOver
            ? 'bg-primary/10 ring-2 ring-primary/30 scale-[1.02]'
            : entry
              ? ''
              : 'border-2 border-dashed border-border/40 hover:border-border/60 hover:bg-muted/20'
        }`}
      >
        {entry ? (
          <DraggableRecipeCard
            entry={entry}
            onRemove={onRemoveRecipe}
            onUpdateServings={onUpdateServings}
          />
        ) : (
          <button
            onClick={onAddRecipe}
            className="w-full min-h-[52px] flex items-center justify-center rounded-lg hover:bg-muted/30 transition-colors group"
          >
            <div className="flex items-center gap-1.5 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">
              <Plus className="h-4 w-4" />
              <span className="text-xs font-medium hidden sm:inline">Add</span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
