import { describe, expect, it } from 'vitest';
import {
  randomCrew,
  sameCrew,
  toggleCrewMember,
} from './crew-selection';

describe('crew selection', () => {
  it('adds in leader order and removes an existing member', () => {
    expect(toggleCrewMember(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleCrewMember(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('caps a crew at four unique characters', () => {
    expect(toggleCrewMember(['a', 'b', 'c', 'd'], 'e')).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('treats roster order as meaningful because the first member leads', () => {
    expect(sameCrew(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameCrew(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  it('builds a bounded random crew without duplicates', () => {
    // Fisher–Yates with a constant 0 RNG always swaps with index 0,
    // so the final slice is a deterministic rotation of the unique list.
    expect(randomCrew(['a', 'b', 'b', 'c', 'd', 'e'], 4, () => 0)).toEqual([
      'b',
      'c',
      'd',
      'e',
    ]);
    const roster = randomCrew(['a', 'b', 'c', 'd', 'e'], 4, () => 0.5);
    expect(roster).toHaveLength(4);
    expect(new Set(roster).size).toBe(4);
    expect(roster.every((id) => ['a', 'b', 'c', 'd', 'e'].includes(id))).toBe(
      true,
    );
  });
});
