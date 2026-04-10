import { describe, it, expect } from 'vitest';
import { parseIngredientText } from '../parseIngredientText';

describe('parseIngredientText', () => {
  it('parses amount, unit, and name', () => {
    const result = parseIngredientText('2 cups flour');
    expect(result.amount).toBe(2);
    expect(result.unit).toBe('cups');
    expect(result.name).toBe('flour');
  });

  it('parses fraction ingredient', () => {
    const result = parseIngredientText('1/2 tsp salt');
    expect(result.amount).toBe(0.5);
    expect(result.unit).toBe('tsp');
    expect(result.name).toBe('salt');
  });

  it('handles no unit', () => {
    const result = parseIngredientText('3 eggs');
    expect(result.amount).toBe(3);
    expect(result.unit).toBe('');
    expect(result.name).toBe('eggs');
  });

  it('handles empty string', () => {
    const result = parseIngredientText('');
    expect(result.amount).toBe(0);
    expect(result.name).toBe('');
  });

  it('handles text with no number', () => {
    const result = parseIngredientText('salt to taste');
    expect(result.amount).toBe(0);
    expect(result.name).toBe('salt to taste');
  });
});
