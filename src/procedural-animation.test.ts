import { describe, expect, it } from 'vitest';
import {
  PROCEDURAL_DURATIONS,
  PROCEDURAL_PRESETS,
  RELAXED_REST_POSE,
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

  it('uses an unmistakably relaxed fallback stance instead of a T-pose', () => {
    const idle = sampleProceduralPose('breathing-idle', 0);
    expect(Math.abs(idle.leftUpperArm?.[2] ?? 0)).toBeGreaterThan(0.9);
    expect(Math.abs(idle.rightUpperArm?.[2] ?? 0)).toBeGreaterThan(0.9);
    expect(Math.abs(RELAXED_REST_POSE.leftLowerLeg?.[0] ?? 0)).toBeGreaterThan(
      0.04,
    );
  });

  it('gives every fallback action a visible pose instead of bind pose', () => {
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
      expect(Math.abs(active - early), preset).toBeGreaterThan(0.005);
    }
  });
});
