// lib/utils.ts
// Utility functions for class name merging

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getOrSet<K, V>(map: Map<K, V>, key: K, computeDefault: () => V): V {
  const attempt = map.get(key);
  if (attempt !== undefined) return attempt;
  const defaultValue = computeDefault();
  map.set(key, defaultValue);
  return defaultValue;
}
