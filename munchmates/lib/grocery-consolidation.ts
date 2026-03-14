import { AggregatedIngredient } from "@/lib/types/meal-plan";

export interface ConsolidationInput {
  name: string;
  amount: number;
  unit?: string;
  category?: string;
  sourceRecipe?: string;
}

type UnitKind = "volume" | "weight" | "count" | "unknown";

interface UnitDefinition {
  kind: UnitKind;
  baseUnit: string;
  factor: number;
  canonicalUnit: string;
}

interface ParsedQuantityPart {
  amount: number;
  unit: string;
}

interface ConsolidatedBucket {
  key: string;
  kind: UnitKind;
  canonicalUnit: string;
  amounts: { amount: number; unit: string }[];
}

interface GroupedIngredient {
  displayName: string;
  normalizedName: string;
  category: string;
  sourceRecipes: Set<string>;
  buckets: Map<string, ConsolidatedBucket>;
}

const UNIT_DEFINITIONS: Record<string, UnitDefinition> = {
  ml: { kind: "volume", baseUnit: "ml", factor: 1, canonicalUnit: "ml" },
  milliliter: { kind: "volume", baseUnit: "ml", factor: 1, canonicalUnit: "ml" },
  milliliters: { kind: "volume", baseUnit: "ml", factor: 1, canonicalUnit: "ml" },
  l: { kind: "volume", baseUnit: "ml", factor: 1000, canonicalUnit: "l" },
  liter: { kind: "volume", baseUnit: "ml", factor: 1000, canonicalUnit: "l" },
  liters: { kind: "volume", baseUnit: "ml", factor: 1000, canonicalUnit: "l" },
  tsp: { kind: "volume", baseUnit: "ml", factor: 4.92892, canonicalUnit: "tsp" },
  teaspoon: { kind: "volume", baseUnit: "ml", factor: 4.92892, canonicalUnit: "tsp" },
  teaspoons: { kind: "volume", baseUnit: "ml", factor: 4.92892, canonicalUnit: "tsp" },
  tbsp: { kind: "volume", baseUnit: "ml", factor: 14.7868, canonicalUnit: "tbsp" },
  tablespoon: { kind: "volume", baseUnit: "ml", factor: 14.7868, canonicalUnit: "tbsp" },
  tablespoons: { kind: "volume", baseUnit: "ml", factor: 14.7868, canonicalUnit: "tbsp" },
  cup: { kind: "volume", baseUnit: "ml", factor: 236.588, canonicalUnit: "cup" },
  cups: { kind: "volume", baseUnit: "ml", factor: 236.588, canonicalUnit: "cup" },
  "fl oz": { kind: "volume", baseUnit: "ml", factor: 29.5735, canonicalUnit: "fl oz" },
  "fluid ounce": { kind: "volume", baseUnit: "ml", factor: 29.5735, canonicalUnit: "fl oz" },
  "fluid ounces": { kind: "volume", baseUnit: "ml", factor: 29.5735, canonicalUnit: "fl oz" },

  g: { kind: "weight", baseUnit: "g", factor: 1, canonicalUnit: "g" },
  gram: { kind: "weight", baseUnit: "g", factor: 1, canonicalUnit: "g" },
  grams: { kind: "weight", baseUnit: "g", factor: 1, canonicalUnit: "g" },
  kg: { kind: "weight", baseUnit: "g", factor: 1000, canonicalUnit: "kg" },
  kilogram: { kind: "weight", baseUnit: "g", factor: 1000, canonicalUnit: "kg" },
  kilograms: { kind: "weight", baseUnit: "g", factor: 1000, canonicalUnit: "kg" },
  oz: { kind: "weight", baseUnit: "g", factor: 28.3495, canonicalUnit: "oz" },
  ounce: { kind: "weight", baseUnit: "g", factor: 28.3495, canonicalUnit: "oz" },
  ounces: { kind: "weight", baseUnit: "g", factor: 28.3495, canonicalUnit: "oz" },
  lb: { kind: "weight", baseUnit: "g", factor: 453.592, canonicalUnit: "lb" },
  lbs: { kind: "weight", baseUnit: "g", factor: 453.592, canonicalUnit: "lb" },
  pound: { kind: "weight", baseUnit: "g", factor: 453.592, canonicalUnit: "lb" },
  pounds: { kind: "weight", baseUnit: "g", factor: 453.592, canonicalUnit: "lb" },

  "": { kind: "count", baseUnit: "count", factor: 1, canonicalUnit: "" },
  piece: { kind: "count", baseUnit: "count", factor: 1, canonicalUnit: "" },
  pieces: { kind: "count", baseUnit: "count", factor: 1, canonicalUnit: "" },
  item: { kind: "count", baseUnit: "count", factor: 1, canonicalUnit: "" },
  items: { kind: "count", baseUnit: "count", factor: 1, canonicalUnit: "" },
  whole: { kind: "count", baseUnit: "count", factor: 1, canonicalUnit: "" },
  clove: { kind: "count", baseUnit: "clove", factor: 1, canonicalUnit: "clove" },
  cloves: { kind: "count", baseUnit: "clove", factor: 1, canonicalUnit: "clove" },
  slice: { kind: "count", baseUnit: "slice", factor: 1, canonicalUnit: "slice" },
  slices: { kind: "count", baseUnit: "slice", factor: 1, canonicalUnit: "slice" },
  can: { kind: "count", baseUnit: "can", factor: 1, canonicalUnit: "can" },
  cans: { kind: "count", baseUnit: "can", factor: 1, canonicalUnit: "can" },
  package: { kind: "count", baseUnit: "package", factor: 1, canonicalUnit: "package" },
  packages: { kind: "count", baseUnit: "package", factor: 1, canonicalUnit: "package" },
}

function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function normalizeUnit(unit: string | undefined | null): string {
  return (unit ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}

function getUnitDefinition(unit: string): UnitDefinition | null {
  return UNIT_DEFINITIONS[normalizeUnit(unit)] ?? null;
}

function getBucketKey(unit: string): { key: string; canonicalUnit: string; kind: UnitKind } {
  const definition = getUnitDefinition(unit);
  if (!definition) {
    const normalizedUnit = normalizeUnit(unit);
    return {
      key: `unknown:${normalizedUnit || "unitless"}`,
      canonicalUnit: normalizedUnit,
      kind: "unknown",
    };
  }

  return {
    key: `${definition.kind}:${definition.baseUnit}`,
    canonicalUnit: definition.canonicalUnit,
    kind: definition.kind,
  };
}

function chooseDisplayUnit(totalAmount: number, baseUnit: string): { amount: number; unit: string } {
  if (baseUnit === "ml") {
    if (totalAmount >= 1000) return { amount: totalAmount / 1000, unit: "l" };
    if (totalAmount >= 236.588) return { amount: totalAmount / 236.588, unit: "cup" };
    if (totalAmount >= 14.7868) return { amount: totalAmount / 14.7868, unit: "tbsp" };
    return { amount: totalAmount / 4.92892, unit: "tsp" };
  }

  if (baseUnit === "g") {
    if (totalAmount >= 1000) return { amount: totalAmount / 1000, unit: "kg" };
    if (totalAmount >= 453.592) return { amount: totalAmount / 453.592, unit: "lb" };
    if (totalAmount >= 28.3495) return { amount: totalAmount / 28.3495, unit: "oz" };
    return { amount: totalAmount, unit: "g" };
  }

  return { amount: totalAmount, unit: baseUnit === "count" ? "" : baseUnit };
}

function singularizeCountUnit(unit: string, amount: number): string {
  if (!unit) return "";
  const normalized = normalizeUnit(unit);
  const singularMap: Record<string, string> = {
    cloves: "clove",
    slices: "slice",
    cans: "can",
    packages: "package",
    pieces: "piece",
    items: "item",
  };
  const singular = singularMap[normalized] ?? normalized;
  return amount === 1 ? singular : singular.endsWith("s") ? singular : `${singular}s`;
}

function formatNumber(amount: number): string {
  const rounded = roundAmount(amount);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/\.?0+$/, "");
}

export function formatQuantity(amount: number, unit: string): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const numeric = formatNumber(amount);
  if (!unit) return numeric;
  return `${numeric} ${unit}`;
}

function buildAggregatedIngredient(
  group: GroupedIngredient,
  bucket: ConsolidatedBucket
): AggregatedIngredient {
  const definition = getUnitDefinition(bucket.canonicalUnit);

  if (definition) {
    const totalBaseAmount = bucket.amounts.reduce((sum, item) => {
      const itemDefinition = getUnitDefinition(item.unit) ?? definition;
      return sum + item.amount * itemDefinition.factor;
    }, 0);

    if (definition.kind === "volume" || definition.kind === "weight") {
      const display = chooseDisplayUnit(totalBaseAmount, definition.baseUnit);
      return {
        name: group.displayName,
        totalAmount: roundAmount(display.amount),
        unit: display.unit,
        category: group.category,
        sourceRecipes: Array.from(group.sourceRecipes),
      };
    }

    const amount = roundAmount(totalBaseAmount);
    return {
      name: group.displayName,
      totalAmount: amount,
      unit: singularizeCountUnit(bucket.canonicalUnit, amount),
      category: group.category,
      sourceRecipes: Array.from(group.sourceRecipes),
    };
  }

  const totalAmount = roundAmount(bucket.amounts.reduce((sum, item) => sum + item.amount, 0));
  return {
    name: group.displayName,
    totalAmount,
    unit: bucket.canonicalUnit,
    category: group.category,
    sourceRecipes: Array.from(group.sourceRecipes),
  };
}

export function consolidateIngredients(items: ConsolidationInput[]): AggregatedIngredient[] {
  const grouped = new Map<string, GroupedIngredient>();

  for (const item of items) {
    const name = String(item.name ?? "").trim();
    const amount = Number(item.amount);
    if (!name || !Number.isFinite(amount) || amount <= 0) continue;

    const category = String(item.category || "Pantry").trim() || "Pantry";
    const normalizedUnitValue = normalizeUnit(item.unit);
    const { key, canonicalUnit, kind } = getBucketKey(normalizedUnitValue);
    const ingredientKey = name;

    if (!grouped.has(ingredientKey)) {
      grouped.set(ingredientKey, {
        displayName: name,
        normalizedName: ingredientKey,
        category,
        sourceRecipes: new Set<string>(),
        buckets: new Map<string, ConsolidatedBucket>(),
      });
    }

    const group = grouped.get(ingredientKey)!;
    if (item.sourceRecipe) group.sourceRecipes.add(item.sourceRecipe);
    if (!group.buckets.has(key)) {
      group.buckets.set(key, {
        key,
        kind,
        canonicalUnit,
        amounts: [],
      });
    }

    group.buckets.get(key)!.amounts.push({
      amount,
      unit: normalizedUnitValue,
    });
  }

  const consolidated: AggregatedIngredient[] = [];
  for (const group of grouped.values()) {
    for (const bucket of group.buckets.values()) {
      consolidated.push(buildAggregatedIngredient(group, bucket));
    }
  }

  consolidated.sort((left, right) => {
    if (left.category !== right.category) return left.category.localeCompare(right.category);
    if (left.name !== right.name) return left.name.localeCompare(right.name);
    return normalizeUnit(left.unit).localeCompare(normalizeUnit(right.unit));
  });

  return consolidated;
}

function parseFractionToken(token: string): number | null {
  if (!token.includes("/")) {
    const numeric = Number(token);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const [numerator, denominator] = token.split("/");
  const top = Number(numerator);
  const bottom = Number(denominator);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) return null;
  return top / bottom;
}

function parseQuantityPart(part: string): ParsedQuantityPart | null {
  const trimmed = part.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*(.*)$/);
  if (!match) return null;

  const amountTokens = match[1].trim().split(/\s+/);
  let amount = 0;
  for (const token of amountTokens) {
    const parsed = parseFractionToken(token);
    if (parsed === null) return null;
    amount += parsed;
  }

  return {
    amount,
    unit: normalizeUnit(match[2]),
  };
}

export function parseQuantityString(quantity: string | null | undefined): ParsedQuantityPart[] {
  if (!quantity) return [];
  return quantity
    .split(/\s*\+\s*/)
    .map(parseQuantityPart)
    .filter((part): part is ParsedQuantityPart => part !== null);
}

export function mergeQuantityStrings(
  existingQuantity: string | null | undefined,
  incomingAmount: number,
  incomingUnit: string
): string | null {
  const incoming = consolidateIngredients([
    { name: "ingredient", amount: incomingAmount, unit: incomingUnit, category: "Pantry" },
  ]);
  if (incoming.length === 0) return existingQuantity ?? null;

  const existingParts = parseQuantityString(existingQuantity).map((part) => ({
    name: "ingredient",
    amount: part.amount,
    unit: part.unit,
    category: "Pantry",
  }));

  const merged = consolidateIngredients([
    ...existingParts,
    {
      name: "ingredient",
      amount: incoming[0].totalAmount,
      unit: incoming[0].unit,
      category: "Pantry",
    },
  ]);

  const formatted = merged
    .map((part) => formatQuantity(part.totalAmount, part.unit))
    .filter(Boolean)
    .join(" + ");

  return formatted || null;
}
