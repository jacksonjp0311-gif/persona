import { describe, expect, it } from 'vitest';
import {
  MAX_DANCE_ROOT_YAW,
  PROCEDURAL_DURATIONS,
  PROCEDURAL_PRESETS,
  RELAXED_REST_POSE,
  frontFacingProceduralPose,
  isProceduralPreset,
  proceduralBlendWeight,
  sampleProceduralPose,
  sampleProceduralRoot,
} from './procedural-animation';

describe('procedural animation library', () => {
  it('ships a large, uniquely named action set', () => {
    expect(PROCEDURAL_PRESETS).toHaveLength(54);
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

  it('keeps football actions out of the bilateral T-pose danger zone', () => {
    const footballPresets = [
      'quarterback-throw',
      'receiver-catch',
      'touchdown-signal',
      'ball-spike',
      'first-down',
      'juke-left-right',
      'stiff-arm',
      'huddle-clap',
      'victory-flex',
      'griddy-celebration',
    ] as const;

    for (const preset of footballPresets) {
      for (const progress of [0.15, 0.45, 0.75]) {
        const pose = {
          ...RELAXED_REST_POSE,
          ...sampleProceduralPose(
            preset,
            PROCEDURAL_DURATIONS[preset] * progress,
          ),
        };
        const leftDrop = Math.abs(pose.leftUpperArm?.[2] ?? 0);
        const rightDrop = Math.abs(pose.rightUpperArm?.[2] ?? 0);
        expect(Math.max(leftDrop, rightDrop), preset).toBeGreaterThan(0.5);
      }
    }
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

  it('never turns dancers completely around on the root or hips', () => {
    for (const preset of PROCEDURAL_PRESETS) {
      const duration = PROCEDURAL_DURATIONS[preset];
      for (const progress of [0, 0.2, 0.45, 0.7, 0.95, 1.4, 3.1, 8]) {
        const time = duration * progress;
        const root = sampleProceduralRoot(preset, time);
        expect(Math.abs(root.yaw), `${preset} root`).toBeLessThanOrEqual(
          MAX_DANCE_ROOT_YAW + 1e-6,
        );
        const pose = frontFacingProceduralPose(
          sampleProceduralPose(preset, time),
        );
        for (const bone of ['hips', 'spine', 'chest', 'upperChest'] as const) {
          const yaw = pose[bone]?.[1];
          if (yaw == null) continue;
          expect(Math.abs(yaw), `${preset} ${bone}`).toBeLessThanOrEqual(0.18);
        }
      }
    }
  });
});
