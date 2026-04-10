import { normalize } from "@/lib/normalize";
import { parseQuantity } from "@/lib/parseQuantity";
import {
  convertToBase,
  COUNT_MULTIPLIERS,
  getUnitType,
  normalizeUnit,
} from "@/lib/unit-conversion";

export interface PantryItemRecord {
  id: number;
  userId?: string;
  name: string;
  canonName: string;
  quantity: string;
  amount: number | null;
  unit: string;
  category: string;
  expiryDate: Date | null;
  addedAt: Date;
}

export interface PantryResponseItem {
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

export interface PantryIngredientInput {
  name: string;
  amount: number;
  unit: string;
}

export interface PantryIngredientMatch {
  ingredientIndex: number;
  ingredientName: string;
  ingredientAmount: number;
  ingredientUnit: string;
  pantryItem: {
    id: number;
    name: string;
    amount: number | null;
    unit: string;
  } | null;
  status: "matched" | "partial" | "unmatched";
}

interface PantryRepository {
  user: {
    upsert(args: {
      where: { id: string };
      update: Record<string, never>;
      create: { id: string };
    }): Promise<unknown>;
  };
  pantryItem: {
    findFirst(args: { where: Record<string, unknown> }): Promise<PantryItemRecord | null>;
    findMany(args: { where: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> }): Promise<PantryItemRecord[]>;
    create(args: { data: Record<string, unknown> }): Promise<PantryItemRecord>;
    update(args: { where: { id: number }; data: Record<string, unknown> }): Promise<PantryItemRecord>;
    delete(args: { where: { id: number } }): Promise<unknown>;
  };
}

interface SanitizedPantryQuantity {
  quantity: string;
  amount: number | null;
  unit: string;
}

export class PantryServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PantryServiceError";
  }
}

function requireTrimmedString(value: unknown, fieldName: string, maxLength: number): string {
  const trimmed = String(value ?? "").trim().slice(0, maxLength);
  if (!trimmed) {
    throw new PantryServiceError(400, `Missing required field: ${fieldName}`);
  }
  return trimmed;
}

function sanitizeOptionalDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sanitizeAmount(amountValue: unknown): number {
  const amount = Number(amountValue);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PantryServiceError(400, "Amount must be a positive number");
  }
  return amount;
}

export function sanitizePantryQuantity(
  body: Record<string, unknown>,
  options: { requireQuantity: boolean },
): SanitizedPantryQuantity {
  const hasStructured = body.amount !== undefined && body.amount !== null;

  if (hasStructured) {
    const amount = sanitizeAmount(body.amount);
    const unit = String(body.unit ?? "").trim().slice(0, 50);
    const quantity = body.quantity
      ? String(body.quantity).trim().slice(0, 100)
      : `${amount} ${unit}`.trim();

    return { quantity, amount, unit };
  }

  if (body.quantity === undefined || body.quantity === null || String(body.quantity).trim() === "") {
    if (options.requireQuantity) {
      throw new PantryServiceError(400, "Missing required field: quantity (or amount)");
    }
    return { quantity: "", amount: null, unit: "" };
  }

  const quantity = String(body.quantity).trim().slice(0, 100);
  const parsed = parseQuantity(quantity);
  if (parsed && parsed.amount <= 0) {
    throw new PantryServiceError(400, "Amount must be a positive number");
  }

  return {
    quantity,
    amount: parsed?.amount ?? null,
    unit: parsed?.unit ?? "",
  };
}

export function formatPantryItemResponse(item: PantryItemRecord): PantryResponseItem {
  let amount = item.amount;
  let unit = item.unit;

  if (amount === null && item.quantity) {
    const parsed = parseQuantity(item.quantity);
    if (parsed) {
      amount = parsed.amount;
      unit = parsed.unit;
    }
  }

  return {
    id: item.id,
    name: item.name,
    canonName: item.canonName || normalize(item.name),
    quantity: item.quantity,
    amount,
    unit,
    category: item.category,
    expiryDate: item.expiryDate?.toISOString().split("T")[0] ?? null,
    addedAt: item.addedAt.toISOString().split("T")[0],
  };
}

async function ensureUser(repo: PantryRepository, userId: string): Promise<void> {
  await repo.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });
}

export async function addPantryItem(
  repo: PantryRepository,
  userId: string,
  body: Record<string, unknown>,
): Promise<PantryItemRecord> {
  const name = requireTrimmedString(body.name, "name", 200);
  const category = requireTrimmedString(body.category, "category", 100);
  const expiryDate = sanitizeOptionalDate(body.expiryDate);
  const { quantity, amount, unit } = sanitizePantryQuantity(body, { requireQuantity: true });

  await ensureUser(repo, userId);

  const canonName = normalize(name);
  const existing = await repo.pantryItem.findFirst({
    where: { userId, canonName },
  });

  if (existing) {
    return repo.pantryItem.update({
      where: { id: existing.id },
      data: {
        quantity,
        amount,
        unit,
        category,
        expiryDate,
        canonName,
      },
    });
  }

  return repo.pantryItem.create({
    data: {
      userId,
      name,
      canonName,
      quantity,
      amount,
      unit,
      category,
      expiryDate,
    },
  });
}

export async function updatePantryItem(
  repo: PantryRepository,
  userId: string,
  body: Record<string, unknown>,
): Promise<PantryItemRecord> {
  const itemId = Number(body.id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    throw new PantryServiceError(400, "Missing required field: id");
  }

  const existing = await repo.pantryItem.findFirst({
    where: { id: itemId, userId },
  });

  if (!existing) {
    throw new PantryServiceError(404, "Item not found");
  }

  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = requireTrimmedString(body.name, "name", 200);
    updateData.name = name;
    updateData.canonName = normalize(name);
  }

  if (body.amount !== undefined || body.quantity !== undefined) {
    const quantityDetails = sanitizePantryQuantity(body, { requireQuantity: false });
    if (quantityDetails.quantity) {
      updateData.quantity = quantityDetails.quantity;
    }
    updateData.amount = quantityDetails.amount;
    updateData.unit = quantityDetails.unit;
  }

  if (body.category !== undefined) {
    updateData.category = requireTrimmedString(body.category, "category", 100);
  }

  if (body.expiryDate !== undefined) {
    updateData.expiryDate = sanitizeOptionalDate(body.expiryDate);
  }

  return repo.pantryItem.update({
    where: { id: itemId },
    data: updateData,
  });
}

export async function deletePantryItem(
  repo: PantryRepository,
  userId: string,
  idValue: string | null,
): Promise<void> {
  if (!idValue) {
    throw new PantryServiceError(400, "Missing required param: id");
  }

  const itemId = Number.parseInt(idValue, 10);
  if (Number.isNaN(itemId)) {
    throw new PantryServiceError(400, "Invalid id");
  }

  const existing = await repo.pantryItem.findFirst({
    where: { id: itemId, userId },
  });

  if (!existing) {
    throw new PantryServiceError(404, "Item not found");
  }

  await repo.pantryItem.delete({
    where: { id: itemId },
  });
}

const GENERIC_WORDS = new Set([
  "sauce",
  "oil",
  "cream",
  "powder",
  "fresh",
  "dried",
  "ground",
  "whole",
  "raw",
  "cooked",
  "hot",
  "cold",
  "red",
  "green",
  "white",
  "black",
  "dark",
  "light",
  "sweet",
  "large",
  "small",
  "medium",
]);

export function matchPantryIngredients(
  pantryItems: PantryItemRecord[],
  ingredients: PantryIngredientInput[],
): PantryIngredientMatch[] {
  const pantryByCanon = new Map<string, PantryItemRecord>();
  for (const item of pantryItems) {
    const canon = item.canonName || normalize(item.name);
    pantryByCanon.set(canon, item);
  }

  function fuzzyFindPantryItem(ingredientCanon: string): PantryItemRecord | undefined {
    const ingredientWords = ingredientCanon.split(/\s+/).filter((word) => word.length > 1);

    let bestMatch: PantryItemRecord | undefined;
    let bestScore = 0;

    for (const [canon, item] of pantryByCanon) {
      const pantryWords = canon.split(/\s+/).filter((word) => word.length > 1);

      if (
        ingredientCanon.startsWith(`${canon} `) ||
        ingredientCanon === canon ||
        canon.startsWith(`${ingredientCanon} `)
      ) {
        const score = Math.min(canon.length, ingredientCanon.length) * 10;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = item;
        }
        continue;
      }

      if (
        ingredientCanon.endsWith(` ${canon}`) ||
        canon.endsWith(` ${ingredientCanon}`)
      ) {
        const score = Math.min(canon.length, ingredientCanon.length) * 8;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = item;
        }
        continue;
      }

      const matchedWords = pantryWords.filter((pantryWord) =>
        ingredientWords.some((ingredientWord) => ingredientWord === pantryWord),
      );
      if (matchedWords.length === pantryWords.length && pantryWords.length > 0) {
        const hasSpecificWord = matchedWords.some((word) => !GENERIC_WORDS.has(word));
        if (hasSpecificWord) {
          const score = matchedWords.length * 10 + canon.length;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = item;
          }
        }
      }
    }

    return bestMatch;
  }

  return ingredients.map((ingredient, index) => {
    const ingredientCanon = normalize(ingredient.name);
    const pantryItem = pantryByCanon.get(ingredientCanon) ?? fuzzyFindPantryItem(ingredientCanon);

    if (!pantryItem) {
      return {
        ingredientIndex: index,
        ingredientName: ingredient.name,
        ingredientAmount: ingredient.amount,
        ingredientUnit: ingredient.unit,
        pantryItem: null,
        status: "unmatched",
      };
    }

    let pantryAmount = pantryItem.amount;
    let pantryUnit = pantryItem.unit;
    if (pantryAmount === null) {
      const parsed = parseQuantity(pantryItem.quantity);
      if (parsed) {
        pantryAmount = parsed.amount;
        pantryUnit = parsed.unit;
      }
    }

    const pantryItemResponse = {
      id: pantryItem.id,
      name: pantryItem.name,
      amount: pantryAmount,
      unit: pantryUnit,
    };

    if (pantryAmount === null || !ingredient.amount) {
      return {
        ingredientIndex: index,
        ingredientName: ingredient.name,
        ingredientAmount: ingredient.amount,
        ingredientUnit: ingredient.unit,
        pantryItem: pantryItemResponse,
        status: "matched",
      };
    }

    const ingredientUnitType = getUnitType(ingredient.unit);
    const pantryUnitType = getUnitType(pantryUnit);

    if (ingredientUnitType === pantryUnitType && ingredientUnitType !== "unknown") {
      if (ingredientUnitType === "count") {
        const pantryMultiplier = COUNT_MULTIPLIERS[normalizeUnit(pantryUnit)] ?? 1;
        const ingredientMultiplier = COUNT_MULTIPLIERS[normalizeUnit(ingredient.unit)] ?? 1;
        const pantryCount = pantryAmount * pantryMultiplier;
        const ingredientCount = ingredient.amount * ingredientMultiplier;

        return {
          ingredientIndex: index,
          ingredientName: ingredient.name,
          ingredientAmount: ingredient.amount,
          ingredientUnit: ingredient.unit,
          pantryItem: pantryItemResponse,
          status: pantryCount >= ingredientCount ? "matched" : "partial",
        };
      }

      const ingredientBase = convertToBase(ingredient.amount, ingredient.unit);
      const pantryBase = convertToBase(pantryAmount, pantryUnit);

      if (ingredientBase && pantryBase) {
        return {
          ingredientIndex: index,
          ingredientName: ingredient.name,
          ingredientAmount: ingredient.amount,
          ingredientUnit: ingredient.unit,
          pantryItem: pantryItemResponse,
          status: pantryBase.amount >= ingredientBase.amount ? "matched" : "partial",
        };
      }
    }

    return {
      ingredientIndex: index,
      ingredientName: ingredient.name,
      ingredientAmount: ingredient.amount,
      ingredientUnit: ingredient.unit,
      pantryItem: pantryItemResponse,
      status: "matched",
    };
  });
}
