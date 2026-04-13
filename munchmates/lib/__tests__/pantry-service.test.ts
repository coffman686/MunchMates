import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addPantryItem,
  deletePantryItem,
  formatPantryItemResponse,
  matchPantryIngredients,
  PantryServiceError,
  sanitizePantryQuantity,
  type PantryItemRecord,
  updatePantryItem,
} from "../pantry-service";

function createPantryItem(overrides: Partial<PantryItemRecord> = {}): PantryItemRecord {
  return {
    id: 1,
    userId: "user-1",
    name: "Eggs",
    canonName: "egg",
    quantity: "12",
    amount: 12,
    unit: "",
    category: "Dairy",
    expiryDate: null,
    addedAt: new Date("2026-04-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createRepo() {
  return {
    user: {
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    pantryItem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe("pantry-service quantity sanitization", () => {
  it("builds a quantity string from structured input", () => {
    expect(
      sanitizePantryQuantity({ amount: 2, unit: "cups" }, { requireQuantity: true }),
    ).toEqual({
      quantity: "2 cups",
      amount: 2,
      unit: "cups",
    });
  });

  it("rejects zero and negative amounts", () => {
    expect(() =>
      sanitizePantryQuantity({ amount: 0, unit: "cups" }, { requireQuantity: true }),
    ).toThrowError("Amount must be a positive number");

    expect(() =>
      sanitizePantryQuantity({ quantity: "0 cups" }, { requireQuantity: true }),
    ).toThrowError("Amount must be a positive number");
  });
});

describe("pantry-service add and update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new pantry item when no duplicate exists", async () => {
    const repo = createRepo();
    const createdItem = createPantryItem({ name: "Milk", canonName: "milk", quantity: "2 cups", amount: 2, unit: "cups" });

    repo.pantryItem.findFirst.mockResolvedValue(null);
    repo.pantryItem.create.mockResolvedValue(createdItem);

    const result = await addPantryItem(repo, "user-1", {
      name: " Milk ",
      category: " Dairy ",
      amount: 2,
      unit: "cups",
    });

    expect(repo.user.upsert).toHaveBeenCalledOnce();
    expect(repo.pantryItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        name: "Milk",
        canonName: "milk",
        category: "Dairy",
        quantity: "2 cups",
        amount: 2,
        unit: "cups",
      }),
    });
    expect(result).toBe(createdItem);
  });

  it("updates an existing pantry item when a duplicate canonical name is added", async () => {
    const repo = createRepo();
    const existing = createPantryItem({ id: 7, name: "Eggs", canonName: "egg" });
    const updated = createPantryItem({ id: 7, quantity: "18", amount: 18, category: "Protein" });

    repo.pantryItem.findFirst.mockResolvedValue(existing);
    repo.pantryItem.update.mockResolvedValue(updated);

    const result = await addPantryItem(repo, "user-1", {
      name: " eggs ",
      category: " Protein ",
      quantity: "18",
    });

    expect(repo.pantryItem.create).not.toHaveBeenCalled();
    expect(repo.pantryItem.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({
        canonName: "egg",
        quantity: "18",
        amount: 18,
        unit: "",
        category: "Protein",
      }),
    });
    expect(result).toBe(updated);
  });

  it("updates only the supplied fields for an existing pantry item", async () => {
    const repo = createRepo();
    const existing = createPantryItem({ id: 3, name: "Flour", canonName: "flour", quantity: "1 lb", amount: 1, unit: "lb", category: "Baking" });
    const updated = createPantryItem({ id: 3, name: "Bread Flour", canonName: "bread flour", category: "Pantry" });

    repo.pantryItem.findFirst.mockResolvedValue(existing);
    repo.pantryItem.update.mockResolvedValue(updated);

    const result = await updatePantryItem(repo, "user-1", {
      id: 3,
      name: " Bread Flour ",
      category: " Pantry ",
    });

    expect(repo.pantryItem.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: {
        name: "Bread Flour",
        canonName: "bread flour",
        category: "Pantry",
      },
    });
    expect(result).toBe(updated);
  });

  it("rejects updates for missing pantry items", async () => {
    const repo = createRepo();
    repo.pantryItem.findFirst.mockResolvedValue(null);

    await expect(
      updatePantryItem(repo, "user-1", { id: 999, quantity: "1 cup" }),
    ).rejects.toMatchObject({
      status: 404,
      message: "Item not found",
    });
  });
});

describe("pantry-service delete", () => {
  it("removes an owned pantry item", async () => {
    const repo = createRepo();
    repo.pantryItem.findFirst.mockResolvedValue(createPantryItem({ id: 4 }));

    await deletePantryItem(repo, "user-1", "4");

    expect(repo.pantryItem.delete).toHaveBeenCalledWith({
      where: { id: 4 },
    });
  });

  it("rejects invalid delete ids", async () => {
    const repo = createRepo();

    await expect(deletePantryItem(repo, "user-1", "abc")).rejects.toMatchObject({
      status: 400,
      message: "Invalid id",
    });
  });
});

describe("pantry-service matching", () => {
  it("matches compatible volume units and marks insufficient pantry amounts as partial", () => {
    const pantryItems = [
      createPantryItem({ id: 1, name: "Milk", canonName: "milk", quantity: "1 cup", amount: 1, unit: "cup" }),
    ];

    const matches = matchPantryIngredients(pantryItems, [
      { name: "Milk", amount: 500, unit: "ml" },
    ]);

    expect(matches).toEqual([
      expect.objectContaining({
        ingredientName: "Milk",
        status: "partial",
        pantryItem: expect.objectContaining({ id: 1 }),
      }),
    ]);
  });

  it("uses fuzzy matching for descriptive ingredient names without false generic-word matches", () => {
    const pantryItems = [
      createPantryItem({ id: 2, name: "Olive Oil", canonName: "olive oil", quantity: "1 bottle", amount: 1, unit: "item" }),
      createPantryItem({ id: 3, name: "Cream", canonName: "cream", quantity: "1 cup", amount: 1, unit: "cup" }),
    ];

    const matches = matchPantryIngredients(pantryItems, [
      { name: "Extra Virgin Olive Oil", amount: 2, unit: "tbsp" },
      { name: "Creamy Sauce", amount: 1, unit: "cup" },
    ]);

    expect(matches[0]?.status).toBe("matched");
    expect(matches[0]?.pantryItem?.id).toBe(2);
    expect(matches[1]).toEqual(
      expect.objectContaining({
        pantryItem: null,
        status: "unmatched",
      }),
    );
  });

  it("supports count conversions like dozen to individual items", () => {
    const pantryItems = [
      createPantryItem({ id: 5, name: "Eggs", canonName: "egg", quantity: "1 dozen", amount: 1, unit: "dozen" }),
    ];

    const matches = matchPantryIngredients(pantryItems, [
      { name: "Eggs", amount: 6, unit: "" },
      { name: "Eggs", amount: 18, unit: "" },
    ]);

    expect(matches[0]?.status).toBe("matched");
    expect(matches[1]?.status).toBe("partial");
  });
});

describe("pantry-service formatting", () => {
  it("parses legacy quantity strings when structured values are missing", () => {
    expect(
      formatPantryItemResponse(
        createPantryItem({
          amount: null,
          unit: "",
          quantity: "1 1/2 cups",
          expiryDate: new Date("2026-05-01T00:00:00.000Z"),
        }),
      ),
    ).toEqual({
      id: 1,
      name: "Eggs",
      canonName: "egg",
      quantity: "1 1/2 cups",
      amount: 1.5,
      unit: "cups",
      category: "Dairy",
      expiryDate: "2026-05-01",
      addedAt: "2026-04-01",
    });
  });
});
