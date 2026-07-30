import { describe, expect, it } from 'vitest';
import {
  PROCEDURAL_DURATIONS,
  PROCEDURAL_PRESETS,
  isProceduralPreset,
  proceduralBlendWeight,
  sampleProceduralPose,
  sampleProceduralRoot,
} from './procedural-animation';

describe('procedural animation library', () => {
  it('ships a large, uniquely named action set', () => {
    expect(PROCEDURAL_PRESETS).toHaveLength(40);
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

  it('gives every action a visible animated frame instead of a static no-op', () => {
    for (const preset of PROCEDURAL_PRESETS) {
      const duration = PROCEDURAL_DURATIONS[preset];
      const frameEnergy = (elapsed: number) => {
        const weight = proceduralBlendWeight(elapsed, duration, 'once');
        const boneEnergy = Object.values(
          sampleProceduralPose(preset, elapsed),
        ).reduce(
          (total, rotation) =>
            total +
            rotation.reduce((sum, value) => sum + Math.abs(value), 0),
          0,
        );
        const root = sampleProceduralRoot(preset, elapsed);
        const rootEnergy =
          root.position.reduce(
            (sum, value) => sum + Math.abs(value),
            0,
          ) + Math.abs(root.yaw);
        return (boneEnergy + rootEnergy) * weight;
      };
      const early = frameEnergy(0.05);
      const active = frameEnergy(Math.min(0.8, duration * 0.45));
      expect(active, preset).toBeGreaterThan(0.025);
      expect(Math.abs(active - early), preset).toBeGreaterThan(0.01);
    }
  });
});
