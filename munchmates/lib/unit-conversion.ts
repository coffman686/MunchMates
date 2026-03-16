// lib/unit-conversion.ts
// Shared unit conversion utilities for volume and weight measurements
// Used by ingredient-aggregator.ts, pantry match/deduct APIs, and UI formatting

// Unit conversion factors to a base unit (for volume: ml, for weight: grams)
export const VOLUME_CONVERSIONS: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  tsp: 4.929,
  teaspoon: 4.929,
  teaspoons: 4.929,
  tbsp: 14.787,
  tablespoon: 14.787,
  tablespoons: 14.787,
  cup: 236.588,
  cups: 236.588,
  'fl oz': 29.574,
  'fluid ounce': 29.574,
  'fluid ounces': 29.574,
};

export const WEIGHT_CONVERSIONS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

// Normalize unit to lowercase and handle common abbreviations
export function normalizeUnit(unit: string): string {
  return unit.toLowerCase().trim();
}

// Count unit multipliers — convert to individual items
export const COUNT_MULTIPLIERS: Record<string, number> = {
  '': 1,
  piece: 1,
  pieces: 1,
  whole: 1,
  large: 1,
  medium: 1,
  small: 1,
  clove: 1,
  cloves: 1,
  dozen: 12,
  pair: 2,
  half: 0.5,
};

// Check if two units are compatible (same type: volume or weight)
export function getUnitType(unit: string): 'volume' | 'weight' | 'count' | 'unknown' {
  const normalized = normalizeUnit(unit);
  if (VOLUME_CONVERSIONS[normalized]) return 'volume';
  if (WEIGHT_CONVERSIONS[normalized]) return 'weight';
  if (!unit || normalized in COUNT_MULTIPLIERS) {
    return 'count';
  }
  return 'unknown';
}

// Convert amount to base unit
export function convertToBase(amount: number, unit: string): { amount: number; baseUnit: string } | null {
  const normalized = normalizeUnit(unit);

  if (VOLUME_CONVERSIONS[normalized]) {
    return { amount: amount * VOLUME_CONVERSIONS[normalized], baseUnit: 'ml' };
  }

  if (WEIGHT_CONVERSIONS[normalized]) {
    return { amount: amount * WEIGHT_CONVERSIONS[normalized], baseUnit: 'g' };
  }

  return null;
}

// Convert from base unit to a display unit
export function convertFromBase(amount: number, baseUnit: string): { amount: number; unit: string } {
  if (baseUnit === 'ml') {
    if (amount >= 1000) return { amount: amount / 1000, unit: 'L' };
    if (amount >= 236.588) return { amount: amount / 236.588, unit: 'cups' };
    if (amount >= 14.787) return { amount: amount / 14.787, unit: 'tbsp' };
    return { amount: amount / 4.929, unit: 'tsp' };
  }

  if (baseUnit === 'g') {
    if (amount >= 1000) return { amount: amount / 1000, unit: 'kg' };
    if (amount >= 453.592) return { amount: amount / 453.592, unit: 'lbs' };
    if (amount >= 28.3495) return { amount: amount / 28.3495, unit: 'oz' };
    return { amount, unit: 'g' };
  }

  return { amount, unit: baseUnit };
}

// Format amount for display
export function formatAmount(amount: number): string {
  if (Number.isInteger(amount)) return amount.toString();

  // Round to 2 decimal places
  const rounded = Math.round(amount * 100) / 100;

  // Convert common decimals to fractions for display
  const fractions: Record<number, string> = {
    0.25: '1/4',
    0.33: '1/3',
    0.5: '1/2',
    0.67: '2/3',
    0.75: '3/4',
  };

  const decimal = rounded % 1;
  const whole = Math.floor(rounded);

  for (const [dec, frac] of Object.entries(fractions)) {
    if (Math.abs(decimal - parseFloat(dec)) < 0.05) {
      return whole > 0 ? `${whole} ${frac}` : frac;
    }
  }

  return rounded.toString();
}
