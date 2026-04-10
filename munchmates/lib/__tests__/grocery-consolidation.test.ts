import { describe, expect, it } from "vitest";
import {
  consolidateIngredients,
  mergeQuantityStrings,
  parseQuantityString,
} from "../grocery-consolidation";

describe("consolidateIngredients", () => {
  it("aggregates duplicate ingredients from multiple recipes into a unified grocery list", () => {
    const result = consolidateIngredients([
      { name: "Milk", amount: 1, unit: "cup", category: "Dairy", sourceRecipe: "Pancakes" },
      { name: "Milk", amount: 8, unit: "tbsp", category: "Dairy", sourceRecipe: "Biscuits" },
      { name: "Eggs", amount: 6, unit: "", category: "Dairy", sourceRecipe: "Quiche" },
      { name: "Eggs", amount: 1, unit: "dozen", category: "Dairy", sourceRecipe: "Cake" },
    ]);

    expect(result).toEqual([
      {
        name: "Eggs",
        totalAmount: 18,
        unit: "",
        category: "Dairy",
        sourceRecipes: ["Quiche", "Cake"],
      },
      {
        name: "Milk",
        totalAmount: 1.5,
        unit: "cup",
        category: "Dairy",
        sourceRecipes: ["Pancakes", "Biscuits"],
      },
    ]);
  });

  it("preserves separate buckets for incompatible or unknown units and drops invalid amounts", () => {
    const result = consolidateIngredients([
      { name: "Tomatoes", amount: 2, unit: "pieces", category: "Produce", sourceRecipe: "Salad" },
      { name: "Tomatoes", amount: 400, unit: "g", category: "Produce", sourceRecipe: "Sauce" },
      { name: "Tomatoes", amount: 0, unit: "cup", category: "Produce", sourceRecipe: "Ignore Me" },
      { name: "Tomatoes", amount: -1, unit: "cup", category: "Produce", sourceRecipe: "Ignore Me Too" },
    ]);

    expect(result).toEqual([
      {
        name: "Tomatoes",
        totalAmount: 2,
        unit: "",
        category: "Produce",
        sourceRecipes: ["Salad", "Sauce"],
      },
      {
        name: "Tomatoes",
        totalAmount: 14.11,
        unit: "oz",
        category: "Produce",
        sourceRecipes: ["Salad", "Sauce"],
      },
    ]);
  });
});

describe("quantity string helpers", () => {
  it("parses composite quantity strings with fractions", () => {
    expect(parseQuantityString("1 1/2 cups + 2 tbsp")).toEqual([
      { amount: 1.5, unit: "cups" },
      { amount: 2, unit: "tbsp" },
    ]);
  });

  it("merges duplicate quantities into a normalized string", () => {
    expect(mergeQuantityStrings("8 tbsp", 8, "tbsp")).toBe("1 cup");
  });

  it("returns the original quantity when the incoming amount is invalid", () => {
    expect(mergeQuantityStrings("1 cup", 0, "cup")).toBe("1 cup");
  });
});
