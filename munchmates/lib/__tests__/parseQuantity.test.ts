import { describe, it, expect } from 'vitest';
import { parseQuantity } from '../parseQuantity';

describe('parseQuantity', () => {
  it('parses integer with unit', () => {
    expect(parseQuantity('2 cups')).toEqual({ amount: 2, unit: 'cups' });
  });

  it('parses decimal', () => {
    expect(parseQuantity('2.5 oz')).toEqual({ amount: 2.5, unit: 'oz' });
  });

  it('parses simple fraction', () => {
    expect(parseQuantity('1/2 tsp')).toEqual({ amount: 0.5, unit: 'tsp' });
  });

  it('parses mixed fraction', () => {
    expect(parseQuantity('1 1/2 cups')).toEqual({ amount: 1.5, unit: 'cups' });
  });

  it('parses number only', () => {
    expect(parseQuantity('3')).toEqual({ amount: 3, unit: '' });
  });

  it('returns null for empty string', () => {
    expect(parseQuantity('')).toBeNull();
  });
});
