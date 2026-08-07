import { describe, expect, it } from 'vitest';
import { playbackRate, transitionSeconds } from './useVrmAnimation';

describe('animation transitions', () => {
  it('uses emote-speed transitions instead of slow pose dissolves', () => {
    expect(transitionSeconds('IDLE', 'CUSTOM')).toBeLessThanOrEqual(0.2);
    expect(transitionSeconds('TALK', 'IDLE')).toBeLessThanOrEqual(0.35);
  });

  it('plays one-shot actions faster than ambient motion', () => {
    expect(playbackRate('CUSTOM', 'once')).toBeGreaterThan(1.2);
    expect(playbackRate('IDLE', 'loop')).toBeLessThan(1);
  });
});
