import { describe, expect, it } from 'vitest';
import { lipSyncTargets } from './useAmplitudeLipSync';

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
});
