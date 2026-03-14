// lib/parseIngredientText.ts
// Parse freeform ingredient strings like "2 cups flour" into structured data

const KNOWN_UNITS = new Set([
  'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
  'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
  'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms',
  'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters',
  'fl oz', 'fluid ounce', 'fluid ounces',
  'pinch', 'dash', 'bunch', 'can', 'cans', 'clove', 'cloves',
  'piece', 'pieces', 'slice', 'slices', 'whole',
]);

export interface ParsedIngredient {
  amount: number;
  unit: string;
  name: string;
  original: string;
}

export function parseIngredientText(text: string): ParsedIngredient {
  const original = text.trim();
  if (!original) return { amount: 0, unit: '', name: '', original };

  // Match leading number (integer, decimal, fraction, mixed fraction)
  const numberPattern = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.?\d*)\s*/;
  const numberMatch = original.match(numberPattern);

  if (!numberMatch) {
    return { amount: 0, unit: '', name: original, original };
  }

  const rawNumber = numberMatch[1].trim();
  let amount: number;

  // Mixed fraction: "1 1/2"
  if (/^\d+\s+\d+\/\d+$/.test(rawNumber)) {
    const [whole, frac] = rawNumber.split(/\s+/);
    const [num, den] = frac.split('/');
    amount = parseInt(whole) + parseInt(num) / parseInt(den);
  }
  // Simple fraction: "1/2"
  else if (/^\d+\/\d+$/.test(rawNumber)) {
    const [num, den] = rawNumber.split('/');
    amount = parseInt(num) / parseInt(den);
  }
  // Decimal or integer
  else {
    amount = parseFloat(rawNumber);
  }

  if (isNaN(amount)) {
    return { amount: 0, unit: '', name: original, original };
  }

  const remainder = original.slice(numberMatch[0].length).trim();
  if (!remainder) {
    return { amount, unit: '', name: '', original };
  }

  // Try matching a known unit at the start of remainder
  // Check two-word units first ("fl oz", "fluid ounce")
  const words = remainder.split(/\s+/);
  const twoWord = words.slice(0, 2).join(' ').toLowerCase();
  if (KNOWN_UNITS.has(twoWord)) {
    const name = words.slice(2).join(' ').trim();
    return { amount, unit: words.slice(0, 2).join(' '), name, original };
  }

  const oneWord = words[0].toLowerCase();
  // Strip trailing period or comma from unit
  const cleanUnit = oneWord.replace(/[.,]$/, '');
  if (KNOWN_UNITS.has(cleanUnit)) {
    const name = words.slice(1).join(' ').trim();
    return { amount, unit: words[0].replace(/[.,]$/, ''), name, original };
  }

  // No known unit — entire remainder is the name
  return { amount, unit: '', name: remainder, original };
}
