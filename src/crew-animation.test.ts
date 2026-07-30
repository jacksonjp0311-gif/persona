import { describe, expect, it } from 'vitest';
import { chooseSynchronizedAnimationUrls } from './crew-animation';

describe('chooseSynchronizedAnimationUrls', () => {
  it('chooses exactly one shared clip with an injectable random source', () => {
    const clips = ['one.vrma', 'two.vrma', 'three.vrma'];
    expect(chooseSynchronizedAnimationUrls(clips, () => 0)).toEqual([
      'one.vrma',
    ]);
    expect(chooseSynchronizedAnimationUrls(clips, () => 0.5)).toEqual([
      'two.vrma',
    ]);
    expect(chooseSynchronizedAnimationUrls(clips, () => 1)).toEqual([
      'three.vrma',
    ]);
  });

  it('returns no clip for an empty list and clamps invalid samples', () => {
    expect(chooseSynchronizedAnimationUrls([], () => 0.5)).toEqual([]);
    expect(chooseSynchronizedAnimationUrls(['one.vrma'], () => Number.NaN)).toEqual([
      'one.vrma',
    ]);
  });
});
