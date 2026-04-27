// lib/types/grocery.ts
// Shared types for grocery list items

export interface GroceryItem {
  id: number;
  name: string;
  category: string;
  completed: boolean;
  quantity?: string | null;
  fromMealPlan?: boolean;
  addedAt: string;
}

export interface GroceryCategory {
  id: number;
  name: string;
  sortOrder: number;
}
