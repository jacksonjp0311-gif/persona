import { describe, expect, it } from 'vitest';
import {
  characterMouthSeed,
  lipSyncTargets,
} from './useAmplitudeLipSync';

describe('lip sync targets', () => {
  it('opens the mouth while speaking even without a captured level', () => {
    const targets = lipSyncTargets(1.3, 0, true);
    expect(Math.max(...Object.values(targets))).toBeGreaterThan(0.15);
  });

  it('responds strongly to audible speech', () => {
    const targets = lipSyncTargets(2.1, 0.12, true);
    expect(Math.max(...Object.values(targets))).toBeGreaterThan(0.65);
  });

  it('closes every viseme outside speech', () => {
    expect(Object.values(lipSyncTargets(1, 1, false))).toEqual([
      0, 0, 0, 0, 0,
    ]);
  });

  it('uses different phoneme orders for different characters', () => {
    const first = lipSyncTargets(2.3, 0.12, true, 0.05);
    const second = lipSyncTargets(2.3, 0.12, true, 0.8);
    expect(first).not.toEqual(second);
  });

  it('produces a stable per-character mouth seed', () => {
    expect(characterMouthSeed('Witch')).toBe(characterMouthSeed('Witch'));
    expect(characterMouthSeed('Witch')).not.toBe(
      characterMouthSeed('Polydancer'),
    );
  });
});
