import { describe, expect, it } from 'vitest';
import {
  inferIngredientCategory,
  mapAisleToCategory,
  resolveIngredientCategory,
} from '../ingredient-aggregator';

describe('ingredient category resolution', () => {
  it('keeps Spoonacular aisle-based categories when available', () => {
    expect(
      resolveIngredientCategory({
        id: 1,
        name: 'Milk',
        amount: 1,
        unit: 'cup',
        aisle: 'Milk, Eggs, Other Dairy',
      })
    ).toBe('Dairy');
  });

  it('infers categories for custom recipe ingredients without aisle data', () => {
    expect(
      inferIngredientCategory({
        name: 'Chicken breast',
        original: '1 lb chicken breast',
        originalString: '1 lb chicken breast',
      })
    ).toBe('Meat & Seafood');

    expect(
      inferIngredientCategory({
        name: 'Spinach',
        original: '2 cups spinach',
        originalString: '2 cups spinach',
      })
    ).toBe('Produce');

    expect(
      inferIngredientCategory({
        name: 'Whole milk',
        original: '1 cup whole milk',
        originalString: '1 cup whole milk',
      })
    ).toBe('Dairy');
  });

  it('falls back to Other when an ingredient cannot be classified', () => {
    expect(
      inferIngredientCategory({
        name: 'Xanthan gum blend',
        original: '1 tsp xanthan gum blend',
        originalString: '1 tsp xanthan gum blend',
      })
    ).toBe('Other');
  });

  it('uses Other when aisle text does not map to a supported grocery category', () => {
    expect(mapAisleToCategory('Ethnic Foods')).toBe('Other');
  });
});
