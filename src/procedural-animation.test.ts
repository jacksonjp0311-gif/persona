import { describe, expect, it } from 'vitest';
import {
  PROCEDURAL_DURATIONS,
  PROCEDURAL_PRESETS,
  isProceduralPreset,
  sampleProceduralPose,
} from './procedural-animation';

describe('procedural animation library', () => {
  it('ships a large, uniquely named action set', () => {
    expect(PROCEDURAL_PRESETS).toHaveLength(30);
    expect(new Set(PROCEDURAL_PRESETS).size).toBe(PROCEDURAL_PRESETS.length);
  });

  it('produces finite rotations for every preset', () => {
    for (const preset of PROCEDURAL_PRESETS) {
      expect(PROCEDURAL_DURATIONS[preset]).toBeGreaterThan(0);
      for (const rotation of Object.values(sampleProceduralPose(preset, 0.73))) {
        expect(rotation).toHaveLength(3);
        rotation.forEach((value) => expect(Number.isFinite(value)).toBe(true));
      }
    }
  });

  it('recognizes only shipped presets', () => {
    expect(isProceduralPreset('quarterback-throw')).toBe(true);
    expect(isProceduralPreset('not-a-move')).toBe(false);
  });

  it('changes pose over time', () => {
    expect(sampleProceduralPose('running-man', 0.1)).not.toEqual(
      sampleProceduralPose('running-man', 0.35),
    );
  });
});
