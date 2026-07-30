export const PROCEDURAL_PRESETS = [
  'breathing-idle',
  'conversational-talk',
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
  'two-step',
  'running-man',
  'heel-toe-shuffle',
  'robot-pop',
  'body-wave',
  'moonwalk-glide',
  'salsa-basic',
  'disco-point',
  'hip-hop-bounce',
  'spin-celebration',
  'open-hand-explain',
  'thoughtful-nod',
  'agree-enthusiastic',
  'disagree-shake',
  'shrug',
  'welcome-wave',
  'big-idea',
  'calm-listen',
] as const;

export type ProceduralPreset = (typeof PROCEDURAL_PRESETS)[number];
export type ProceduralBone =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'upperChest'
  | 'neck'
  | 'head'
  | 'leftUpperArm'
  | 'leftLowerArm'
  | 'leftHand'
  | 'rightUpperArm'
  | 'rightLowerArm'
  | 'rightHand'
  | 'leftUpperLeg'
  | 'leftLowerLeg'
  | 'leftFoot'
  | 'rightUpperLeg'
  | 'rightLowerLeg'
  | 'rightFoot';

export type ProceduralPose = Partial<
  Record<ProceduralBone, readonly [number, number, number]>
>;

const TAU = Math.PI * 2;
const clamp = (value: number, low = 0, high = 1) =>
  Math.min(high, Math.max(low, value));
const wave = (time: number, speed = 1, phase = 0) =>
  Math.sin(time * speed * TAU + phase);
const pulse = (time: number, speed = 1, phase = 0) =>
  (wave(time, speed, phase) + 1) * 0.5;
const ease = (value: number) => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};
const beat = (time: number, bpm = 110) =>
  Math.sin(time * (bpm / 60) * TAU);

export const PROCEDURAL_DURATIONS: Readonly<Record<ProceduralPreset, number>> = {
  'breathing-idle': 4,
  'conversational-talk': 4,
  'quarterback-throw': 3.2,
  'receiver-catch': 2.8,
  'touchdown-signal': 2.6,
  'ball-spike': 2.7,
  'first-down': 2.5,
  'juke-left-right': 3,
  'stiff-arm': 2.5,
  'huddle-clap': 3,
  'victory-flex': 2.8,
  'griddy-celebration': 5,
  'two-step': 4,
  'running-man': 4,
  'heel-toe-shuffle': 4,
  'robot-pop': 4,
  'body-wave': 4,
  'moonwalk-glide': 4,
  'salsa-basic': 4,
  'disco-point': 3.5,
  'hip-hop-bounce': 4,
  'spin-celebration': 3.5,
  'open-hand-explain': 4,
  'thoughtful-nod': 3,
  'agree-enthusiastic': 3,
  'disagree-shake': 3,
  shrug: 2.6,
  'welcome-wave': 3.5,
  'big-idea': 3,
  'calm-listen': 4,
};

export function isProceduralPreset(value: unknown): value is ProceduralPreset {
  return (
    typeof value === 'string' &&
    (PROCEDURAL_PRESETS as readonly string[]).includes(value)
  );
}

export function sampleProceduralPose(
  preset: ProceduralPreset,
  time: number,
): ProceduralPose {
  const b = beat(time);
  const sway = wave(time, 0.35);
  const step = wave(time, 1.8);

  switch (preset) {
    case 'breathing-idle':
      return {
        chest: [0.018 * wave(time, 0.22), 0, 0.012 * sway],
        head: [0.018 * wave(time, 0.17), 0.025 * sway, 0],
        leftUpperArm: [0, 0, -0.025 * sway],
        rightUpperArm: [0, 0, -0.025 * sway],
      };
    case 'conversational-talk':
      return {
        hips: [0, 0.035 * sway, 0],
        chest: [0.035 * wave(time, 0.7), 0.06 * sway, 0.025 * b],
        head: [0.05 * wave(time, 0.8), -0.045 * sway, 0],
        leftUpperArm: [-0.18 + 0.12 * b, 0, -0.18],
        leftLowerArm: [-0.5 - 0.18 * wave(time, 0.9), 0, 0],
        rightUpperArm: [-0.16 - 0.12 * b, 0, 0.2],
        rightLowerArm: [-0.55 + 0.2 * wave(time, 1.1), 0, 0],
      };
    case 'quarterback-throw': {
      const p = (time % PROCEDURAL_DURATIONS[preset]) / PROCEDURAL_DURATIONS[preset];
      const load = ease(clamp(p / 0.38));
      const release = ease(clamp((p - 0.38) / 0.25));
      const follow = ease(clamp((p - 0.63) / 0.37));
      return {
        hips: [0, -0.3 * load + 0.65 * release - 0.3 * follow, 0],
        chest: [0.08 * load, -0.55 * load + 0.95 * release - 0.4 * follow, 0],
        rightUpperArm: [-0.5 - 1.25 * load + 1.5 * release, -0.2, 0.55],
        rightLowerArm: [-1.25 * load + 0.9 * release, 0, 0],
        leftUpperArm: [-0.6 + 0.4 * release, 0, -0.35],
        leftLowerArm: [-0.85 + 0.45 * release, 0, 0],
        leftUpperLeg: [0.25 * load - 0.4 * release, 0, 0],
        rightUpperLeg: [-0.2 * load + 0.3 * release, 0, 0],
      };
    }
    case 'receiver-catch': {
      const reach = ease(pulse(time, 0.7));
      return {
        chest: [-0.12 * reach, 0, 0],
        leftUpperArm: [-1.15 * reach, 0, -0.35],
        rightUpperArm: [-1.15 * reach, 0, 0.35],
        leftLowerArm: [-0.35 - 0.45 * reach, 0, 0],
        rightLowerArm: [-0.35 - 0.45 * reach, 0, 0],
        leftHand: [0, -0.18 * reach, 0],
        rightHand: [0, 0.18 * reach, 0],
      };
    }
    case 'touchdown-signal':
      return {
        chest: [-0.08, 0, 0],
        leftUpperArm: [-2.6, 0, -0.25],
        rightUpperArm: [-2.6, 0, 0.25],
        leftLowerArm: [-0.12, 0, 0],
        rightLowerArm: [-0.12, 0, 0],
      };
    case 'ball-spike': {
      const p = (time % 2.7) / 2.7;
      const slam = ease(clamp((p - 0.28) / 0.28));
      return {
        chest: [0.25 * slam, -0.22 * slam, 0],
        rightUpperArm: [-2.4 + 2.8 * slam, 0, 0.25],
        rightLowerArm: [-0.4 + 0.8 * slam, 0, 0],
        leftUpperArm: [-0.25, 0, -0.3],
        leftUpperLeg: [0.22 * slam, 0, 0],
      };
    }
    case 'first-down':
      return {
        hips: [0, 0.15 * sway, 0],
        chest: [0, 0.12 * sway, 0],
        leftUpperArm: [-0.15, 0, -1.2],
        leftLowerArm: [-0.15, 0, 0],
        rightUpperArm: [-0.15, 0, 1.2],
        rightLowerArm: [-0.15, 0, 0],
      };
    case 'juke-left-right':
      return {
        hips: [0.08, 0.32 * step, -0.22 * step],
        chest: [-0.12, -0.2 * step, 0.18 * step],
        leftUpperArm: [-0.45 - 0.2 * step, 0, -0.25],
        rightUpperArm: [-0.45 + 0.2 * step, 0, 0.25],
        leftUpperLeg: [0.45 * step, 0, 0.12 * step],
        rightUpperLeg: [-0.45 * step, 0, 0.12 * step],
        leftLowerLeg: [0.4 * Math.max(0, -step), 0, 0],
        rightLowerLeg: [0.4 * Math.max(0, step), 0, 0],
      };
    case 'stiff-arm':
      return {
        hips: [0.05, -0.18, 0],
        chest: [-0.08, 0.25, 0],
        rightUpperArm: [-0.55, 0.15, 1.15],
        rightLowerArm: [-0.1, 0, 0],
        leftUpperArm: [-0.55, 0, -0.25],
        leftLowerArm: [-0.8, 0, 0],
      };
    case 'huddle-clap': {
      const clap = Math.abs(wave(time, 1.6));
      return {
        chest: [0.08 * b, 0, 0],
        leftUpperArm: [-0.55, 0, -0.42 + 0.3 * clap],
        rightUpperArm: [-0.55, 0, 0.42 - 0.3 * clap],
        leftLowerArm: [-0.9, 0, 0],
        rightLowerArm: [-0.9, 0, 0],
      };
    }
    case 'victory-flex':
      return {
        chest: [-0.1 + 0.03 * b, 0, 0],
        leftUpperArm: [-1.15, 0, -0.85],
        rightUpperArm: [-1.15, 0, 0.85],
        leftLowerArm: [-1.45, 0, 0],
        rightLowerArm: [-1.45, 0, 0],
      };
    case 'griddy-celebration':
      return {
        hips: [0.05 + 0.08 * Math.abs(step), 0.15 * step, -0.1 * step],
        chest: [-0.08, -0.1 * step, 0.08 * step],
        leftUpperArm: [-0.85 + 0.25 * step, 0, -0.18],
        rightUpperArm: [-0.85 - 0.25 * step, 0, 0.18],
        leftLowerArm: [-1.05 + 0.2 * step, 0, 0],
        rightLowerArm: [-1.05 - 0.2 * step, 0, 0],
        leftUpperLeg: [0.52 * step, 0, 0],
        rightUpperLeg: [-0.52 * step, 0, 0],
        leftLowerLeg: [0.55 * Math.max(0, -step), 0, 0],
        rightLowerLeg: [0.55 * Math.max(0, step), 0, 0],
      };
    case 'two-step':
      return {
        hips: [0.04 * Math.abs(step), 0, -0.2 * step],
        chest: [0, 0, 0.12 * step],
        leftUpperArm: [-0.35 - 0.15 * step, 0, -0.2],
        rightUpperArm: [-0.35 + 0.15 * step, 0, 0.2],
        leftUpperLeg: [0.22 * step, 0, 0.14 * step],
        rightUpperLeg: [-0.22 * step, 0, 0.14 * step],
      };
    case 'running-man':
      return {
        hips: [0.12, 0, 0],
        chest: [-0.08, 0, 0],
        leftUpperArm: [-0.5 - 0.45 * step, 0, -0.15],
        rightUpperArm: [-0.5 + 0.45 * step, 0, 0.15],
        leftUpperLeg: [0.75 * step, 0, 0],
        rightUpperLeg: [-0.75 * step, 0, 0],
        leftLowerLeg: [0.7 * Math.max(0, -step), 0, 0],
        rightLowerLeg: [0.7 * Math.max(0, step), 0, 0],
      };
    case 'heel-toe-shuffle':
      return {
        hips: [0.06, 0.18 * step, -0.12 * step],
        chest: [0, -0.1 * step, 0.1 * step],
        leftUpperLeg: [0.12 * step, 0.18 * step, 0],
        rightUpperLeg: [-0.12 * step, -0.18 * step, 0],
        leftFoot: [0.35 * step, 0.2 * step, 0],
        rightFoot: [-0.35 * step, -0.2 * step, 0],
      };
    case 'robot-pop': {
      const snap = Math.sign(beat(time, 100));
      return {
        chest: [0.12 * snap, 0.16 * snap, 0],
        head: [-0.08 * snap, -0.12 * snap, 0],
        leftUpperArm: [-0.75, 0.2 * snap, -0.55],
        rightUpperArm: [-0.75, -0.2 * snap, 0.55],
        leftLowerArm: [-1.1 + 0.18 * snap, 0, 0],
        rightLowerArm: [-1.1 - 0.18 * snap, 0, 0],
      };
    }
    case 'body-wave':
      return {
        hips: [0.12 * wave(time, 0.7, 2.4), 0, 0],
        spine: [0.15 * wave(time, 0.7, 1.7), 0, 0],
        chest: [0.18 * wave(time, 0.7, 0.9), 0, 0],
        upperChest: [0.15 * wave(time, 0.7, 0.3), 0, 0],
        head: [0.08 * wave(time, 0.7), 0, 0],
        leftUpperArm: [-0.35, 0, -0.3],
        rightUpperArm: [-0.35, 0, 0.3],
      };
    case 'moonwalk-glide':
      return {
        hips: [0.06, 0, -0.12 * step],
        chest: [-0.05, 0, 0.08 * step],
        leftUpperLeg: [0.16 * step, 0, 0],
        rightUpperLeg: [-0.16 * step, 0, 0],
        leftLowerLeg: [0.28 * Math.max(0, step), 0, 0],
        rightLowerLeg: [0.28 * Math.max(0, -step), 0, 0],
        leftFoot: [0.38 * step, 0, 0],
        rightFoot: [-0.38 * step, 0, 0],
      };
    case 'salsa-basic':
      return {
        hips: [0.05, 0.12 * step, -0.22 * step],
        chest: [0, -0.08 * step, 0.09 * step],
        leftUpperArm: [-0.5, 0, -0.35 - 0.08 * step],
        rightUpperArm: [-0.5, 0, 0.35 - 0.08 * step],
        leftUpperLeg: [0.32 * step, 0, 0],
        rightUpperLeg: [-0.32 * step, 0, 0],
      };
    case 'disco-point':
      return {
        hips: [0.05, 0.22 * step, -0.15 * step],
        chest: [-0.05, -0.18 * step, 0.12 * step],
        rightUpperArm: [-1.9 + 0.8 * pulse(time, 0.9), 0, 0.75],
        rightLowerArm: [-0.15, 0, 0],
        leftUpperArm: [-0.2, 0, -0.65],
      };
    case 'hip-hop-bounce':
      return {
        hips: [0.12 + 0.1 * Math.abs(b), 0.12 * step, -0.08 * step],
        chest: [-0.1 - 0.08 * Math.abs(b), -0.08 * step, 0.1 * step],
        leftUpperArm: [-0.55 - 0.2 * b, 0, -0.3],
        rightUpperArm: [-0.55 + 0.2 * b, 0, 0.3],
        leftLowerLeg: [0.18 * Math.abs(b), 0, 0],
        rightLowerLeg: [0.18 * Math.abs(b), 0, 0],
      };
    case 'spin-celebration':
      return {
        hips: [0.05, time * 1.9, 0],
        chest: [-0.08, 0, 0],
        leftUpperArm: [-0.3, 0, -1.15],
        rightUpperArm: [-0.3, 0, 1.15],
      };
    case 'open-hand-explain':
      return {
        chest: [0, 0.08 * sway, 0],
        head: [0.025 * wave(time, 0.6), -0.05 * sway, 0],
        leftUpperArm: [-0.35, 0, -0.45],
        rightUpperArm: [-0.4 + 0.12 * b, 0, 0.48],
        leftLowerArm: [-0.7, 0.1, 0],
        rightLowerArm: [-0.7 - 0.2 * b, -0.1, 0],
      };
    case 'thoughtful-nod':
      return {
        head: [0.14 * pulse(time, 0.8), 0.06, 0],
        rightUpperArm: [-0.42, 0, 0.25],
        rightLowerArm: [-1.45, 0.1, 0],
        rightHand: [0, 0.12, 0],
        leftUpperArm: [-0.12, 0, -0.12],
      };
    case 'agree-enthusiastic':
      return {
        chest: [0.06 * Math.abs(b), 0, 0],
        head: [0.2 * wave(time, 1.4), 0, 0],
        leftUpperArm: [-0.35, 0, -0.25],
        rightUpperArm: [-0.35, 0, 0.25],
      };
    case 'disagree-shake':
      return {
        head: [0, 0.28 * wave(time, 1.2), 0],
        chest: [0, -0.08 * wave(time, 1.2), 0],
        leftUpperArm: [-0.28, 0, -0.18],
        rightUpperArm: [-0.28, 0, 0.18],
      };
    case 'shrug':
      return {
        chest: [-0.04, 0, 0],
        head: [0, 0, 0.1],
        leftUpperArm: [-0.18, 0, -0.72],
        rightUpperArm: [-0.18, 0, 0.72],
        leftLowerArm: [-0.75, 0.1, 0],
        rightLowerArm: [-0.75, -0.1, 0],
      };
    case 'welcome-wave':
      return {
        chest: [0, -0.08, 0],
        head: [0, 0.08, 0],
        rightUpperArm: [-1.35, 0, 0.75],
        rightLowerArm: [-1.2, 0, 0],
        rightHand: [0, 0, 0.35 * wave(time, 1.8)],
      };
    case 'big-idea':
      return {
        chest: [-0.08, -0.08, 0],
        head: [-0.06, 0.12, 0],
        rightUpperArm: [-1.55, 0, 0.5],
        rightLowerArm: [-0.35, 0, 0],
        leftUpperArm: [-0.35, 0, -0.3],
        leftLowerArm: [-0.8, 0, 0],
      };
    case 'calm-listen':
      return {
        hips: [0, -0.04, 0],
        chest: [0.02 * wave(time, 0.24), 0.04, 0],
        head: [0.04 * wave(time, 0.34), -0.08, 0.035],
        leftUpperArm: [-0.12, 0, -0.08],
        rightUpperArm: [-0.12, 0, 0.08],
      };
  }
}
