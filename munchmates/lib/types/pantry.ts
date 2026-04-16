// lib/types/pantry.ts
// Shared types for pantry entries

export interface PantryItem {
  id: number;
  name: string;
  canonName: string;
  quantity: string;
  amount: number | null;
  unit: string;
  category: string;
  expiryDate: string | null;
  addedAt: string;
}
