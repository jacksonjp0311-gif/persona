import { describe, expect, it } from 'vitest';
import { createCrewLayout } from './crew-layout';

describe('createCrewLayout', () => {
  it('centers a solo character', () => {
    expect(createCrewLayout(1)).toEqual([
      { position: [0, 0, -0], scale: 1 },
    ]);
  });

  it('creates symmetric, unique crew positions without rotating members', () => {
    for (const count of [2, 3, 4]) {
      const layout = createCrewLayout(count);
      const xs = layout.map(({ position }) => position[0]);
      expect(layout).toHaveLength(count);
      expect(new Set(xs).size).toBe(count);
      expect(xs.reduce((sum, x) => sum + x, 0)).toBeCloseTo(0);
      expect(layout.every(({ position }) => position[1] === 0)).toBe(true);
    }
  });

  it('rejects unsupported crew sizes', () => {
    expect(() => createCrewLayout(0)).toThrow(RangeError);
    expect(() => createCrewLayout(5)).toThrow(RangeError);
    expect(() => createCrewLayout(2.5)).toThrow(RangeError);
  });
});
