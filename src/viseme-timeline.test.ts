import { describe, expect, it } from 'vitest';
import {
  createVisemeTimeline,
  visemeTimelineDuration,
  visemeWeightsAt,
} from './viseme-timeline';

describe('text-driven viseme timeline', () => {
  it('maps vowel sounds and common digraphs to VRM mouth presets', () => {
    const cues = createVisemeTimeline('day feet moon go');
    expect(
      cues.filter((cue) => cue.viseme).map((cue) => cue.viseme),
    ).toEqual(['aa', 'ee', 'ou', 'oh']);
  });

  it('adds natural pauses for punctuation and scales duration with speech rate', () => {
    const normal = createVisemeTimeline('Hello, world.');
    const fast = createVisemeTimeline('Hello, world.', 2);
    const punctuation = normal.filter((cue) => cue.viseme == null);

    expect(punctuation.some((cue) => cue.durationMs >= 100)).toBe(true);
    expect(visemeTimelineDuration(fast)).toBeCloseTo(
      visemeTimelineDuration(normal) / 2,
    );
  });

  it('keeps cues ordered and records source character positions', () => {
    const cues = createVisemeTimeline('A quick reply.');
    for (let index = 1; index < cues.length; index += 1) {
      expect(cues[index].startMs).toBeGreaterThanOrEqual(
        cues[index - 1].startMs + cues[index - 1].durationMs,
      );
      expect(cues[index].charIndex).toBeGreaterThanOrEqual(
        cues[index - 1].charIndex,
      );
    }
  });

  it('crossfades between mouth shapes and closes after the timeline', () => {
    const cues = createVisemeTimeline('ae');
    const duringFirst = visemeWeightsAt(cues, 70);
    const transition = visemeWeightsAt(cues, 104);
    const after = visemeWeightsAt(
      cues,
      visemeTimelineDuration(cues) + 1,
    );

    expect(duringFirst.aa).toBeGreaterThan(0.5);
    expect(transition.aa).toBeGreaterThan(0);
    expect(transition.ee).toBeGreaterThan(0);
    expect(Object.values(after)).toEqual([0, 0, 0, 0, 0]);
  });

  it('uses spoken-vowel approximations for digits', () => {
    const cues = createVisemeTimeline('123');
    expect(cues.map((cue) => cue.viseme)).toEqual(['ou', 'ee']);
  });
});
