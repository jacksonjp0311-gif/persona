import { describe, expect, it } from 'vitest';
import {
  FEATURED_DANCE_IDS,
  FEATURED_DANCE_LABELS,
  dancePlaybackUrls,
  isFeaturedDanceId,
} from './dance-catalog';

describe('dance catalog', () => {
  it('ships eight featured wheel dances with labels', () => {
    expect(FEATURED_DANCE_IDS).toHaveLength(8);
    for (const id of FEATURED_DANCE_IDS) {
      expect(isFeaturedDanceId(id)).toBe(true);
      expect(FEATURED_DANCE_LABELS[id].length).toBeGreaterThan(0);
    }
  });

  it('suppresses clip urls when a procedural preset is available', () => {
    expect(dancePlaybackUrls(['a.vrma', 'b.vrma'], 'freestyle-groove')).toEqual(
      [],
    );
    expect(dancePlaybackUrls(['a.vrma'], null)).toEqual(['a.vrma']);
  });
});
