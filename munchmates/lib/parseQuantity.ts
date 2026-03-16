// lib/parseQuantity.ts
// Parse freeform quantity strings like "2 cups", "1/2 tsp", "3" into structured { amount, unit }

export function parseQuantity(input: string): { amount: number; unit: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Match patterns like: "2", "1/2", "1 1/2", "2.5", "2 cups", "1/2 tsp", "1 1/2 cups"
  const match = trimmed.match(
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.?\d*)\s*(.*)/
  );

  if (!match) return null;

  const rawNumber = match[1].trim();
  const unit = match[2].trim();

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

  if (isNaN(amount)) return null;

  return { amount, unit };
}
