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
  'the-twist',
  'charleston-step',
  'side-shuffle',
  'grapevine-step',
  'jazz-square',
  'box-step',
  'mambo-step',
  'cha-cha',
  'arm-wave',
  'freestyle-groove',
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

export interface ProceduralRootMotion {
  position: readonly [number, number, number];
  yaw: number;
}

export const RELAXED_REST_POSE: Readonly<ProceduralPose> = {
  hips: [0.02, 0, 0],
  spine: [-0.015, 0, 0],
  chest: [-0.025, 0, 0],
  neck: [0.015, 0, 0],
  head: [0.02, 0, 0],
  leftUpperArm: [-0.08, 0.04, -1.02],
  leftLowerArm: [-0.16, -0.04, -0.03],
  rightUpperArm: [-0.08, -0.04, 1.02],
  rightLowerArm: [-0.16, 0.04, 0.03],
  leftUpperLeg: [0.035, 0, -0.015],
  leftLowerLeg: [-0.07, 0, 0],
  rightUpperLeg: [0.035, 0, 0.015],
  rightLowerLeg: [-0.07, 0, 0],
};

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
  'quarterback-throw': 1.8,
  'receiver-catch': 1.6,
  'touchdown-signal': 1.8,
  'ball-spike': 1.8,
  'first-down': 1.6,
  'juke-left-right': 2,
  'stiff-arm': 1.7,
  'huddle-clap': 2,
  'victory-flex': 1.8,
  'griddy-celebration': 4.2,
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
  'the-twist': 4,
  'charleston-step': 4,
  'side-shuffle': 4,
  'grapevine-step': 4,
  'jazz-square': 4,
  'box-step': 4,
  'mambo-step': 4,
  'cha-cha': 4,
  'arm-wave': 4,
  'freestyle-groove': 5,
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

export function proceduralBlendWeight(
  elapsed: number,
  duration: number,
  playback: 'loop' | 'once',
): number {
  void elapsed;
  void duration;
  void playback;
  // Procedural animation is the resilient fallback path. Returning full
  // weight prevents a model's imported bind pose from leaking through while
  // an authored VRMA clip loads or after a one-shot finishes.
  return 1;
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
        hips: [0.025 * Math.abs(sway), 0.07 * sway, -0.035 * sway],
        spine: [0.018 * wave(time, 0.22), -0.035 * sway, 0],
        chest: [0.035 * wave(time, 0.22), -0.04 * sway, 0.035 * sway],
        head: [0.035 * wave(time, 0.17), 0.07 * sway, -0.02 * sway],
        leftUpperArm: [-0.08, 0.04, -1.02 - 0.025 * sway],
        rightUpperArm: [-0.08, -0.04, 1.02 - 0.025 * sway],
        leftLowerArm: [-0.16 - 0.025 * sway, -0.04, -0.03],
        rightLowerArm: [-0.16 + 0.025 * sway, 0.04, 0.03],
      };
    case 'conversational-talk':
      return {
        hips: [0, 0.035 * sway, 0],
        chest: [0.035 * wave(time, 0.7), 0.06 * sway, 0.025 * b],
        head: [0.05 * wave(time, 0.8), -0.045 * sway, 0],
        leftUpperArm: [-0.18 + 0.12 * b, 0.04, -0.92],
        leftLowerArm: [-0.5 - 0.18 * wave(time, 0.9), 0, 0],
        rightUpperArm: [-0.16 - 0.12 * b, -0.04, 0.92],
        rightLowerArm: [-0.55 + 0.2 * wave(time, 1.1), 0, 0],
      };
    case 'quarterback-throw': {
      const p = (time % PROCEDURAL_DURATIONS[preset]) / PROCEDURAL_DURATIONS[preset];
      const load = ease(clamp(p / 0.32));
      const release = ease(clamp((p - 0.32) / 0.26));
      const follow = ease(clamp((p - 0.58) / 0.42));
      return {
        hips: [0.08 * load - 0.05 * release, -0.24 * load + 0.48 * release - 0.24 * follow, 0],
        chest: [0.08 * load, -0.48 * load + 0.92 * release - 0.44 * follow, 0],
        rightUpperArm: [
          -0.35 - 1.45 * load + 1.85 * release - 0.25 * follow,
          -0.16,
          0.95 - 0.22 * load + 0.12 * release,
        ],
        rightLowerArm: [-0.3 - 1.1 * load + 1.55 * release - 0.3 * follow, 0, 0],
        leftUpperArm: [-0.48 + 0.2 * release, 0, -0.88],
        leftLowerArm: [-0.95 + 0.38 * release, 0, 0],
        leftUpperLeg: [0.22 * load - 0.32 * release, 0, 0],
        rightUpperLeg: [-0.18 * load + 0.26 * release, 0, 0],
      };
    }
    case 'receiver-catch': {
      const reach = ease(pulse(time, 0.7));
      return {
        chest: [-0.12 * reach, 0, 0],
        leftUpperArm: [-0.35 - 0.8 * reach, 0, -0.82],
        rightUpperArm: [-0.35 - 0.8 * reach, 0, 0.82],
        leftLowerArm: [-0.35 - 0.45 * reach, 0, 0],
        rightLowerArm: [-0.35 - 0.45 * reach, 0, 0],
        leftHand: [0, -0.18 * reach, 0],
        rightHand: [0, 0.18 * reach, 0],
      };
    }
    case 'touchdown-signal':
      return {
        chest: [-0.08, 0, 0],
        leftUpperArm: [-2.5, 0, -0.72],
        rightUpperArm: [-2.5, 0, 0.72],
        leftLowerArm: [-0.12, 0, 0],
        rightLowerArm: [-0.12, 0, 0],
      };
    case 'ball-spike': {
      const p = (time % PROCEDURAL_DURATIONS[preset]) / PROCEDURAL_DURATIONS[preset];
      const slam = ease(clamp((p - 0.28) / 0.28));
      return {
        chest: [0.25 * slam, -0.22 * slam, 0],
        rightUpperArm: [-2.4 + 2.8 * slam, 0, 0.78],
        rightLowerArm: [-0.4 + 0.8 * slam, 0, 0],
        leftUpperArm: [-0.35, 0, -0.9],
        leftUpperLeg: [0.22 * slam, 0, 0],
      };
    }
    case 'first-down':
      return {
        hips: [0, 0.15 * sway, 0],
        chest: [0, 0.12 * sway, 0],
        leftUpperArm: [-0.15, 0, -0.98],
        leftLowerArm: [-0.35, 0, 0],
        rightUpperArm: [-0.3, 0, 0.55],
        rightLowerArm: [-0.15, 0, 0],
      };
    case 'juke-left-right':
      return {
        hips: [0.08, 0.32 * step, -0.22 * step],
        chest: [-0.12, -0.2 * step, 0.18 * step],
        leftUpperArm: [-0.45 - 0.2 * step, 0, -0.86],
        rightUpperArm: [-0.45 + 0.2 * step, 0, 0.86],
        leftUpperLeg: [0.45 * step, 0, 0.12 * step],
        rightUpperLeg: [-0.45 * step, 0, 0.12 * step],
        leftLowerLeg: [0.4 * Math.max(0, -step), 0, 0],
        rightLowerLeg: [0.4 * Math.max(0, step), 0, 0],
      };
    case 'stiff-arm':
      return {
        hips: [0.05, -0.18, 0],
        chest: [-0.08, 0.25, 0],
        rightUpperArm: [-1.15, 0.15, 0.82],
        rightLowerArm: [-0.1, 0, 0],
        leftUpperArm: [-0.55, 0, -0.9],
        leftLowerArm: [-0.8, 0, 0],
      };
    case 'huddle-clap': {
      const clap = Math.abs(wave(time, 1.6));
      return {
        chest: [0.08 * b, 0, 0],
        leftUpperArm: [-0.72, 0, -0.82 + 0.18 * clap],
        rightUpperArm: [-0.72, 0, 0.82 - 0.18 * clap],
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
        leftUpperArm: [-0.85 + 0.25 * step, 0, -0.82],
        rightUpperArm: [-0.85 - 0.25 * step, 0, 0.82],
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
        hips: [0.05, 0, 0],
        chest: [-0.08, 0, 0],
        leftUpperArm: [-0.3, 0, -1.15],
        rightUpperArm: [-0.3, 0, 1.15],
      };
    case 'the-twist':
      return {
        hips: [0.14 * Math.abs(b), 0.48 * step, 0],
        chest: [-0.08, -0.36 * step, 0],
        leftUpperArm: [-0.45, 0, -0.42 + 0.12 * step],
        rightUpperArm: [-0.45, 0, 0.42 + 0.12 * step],
        leftLowerArm: [-0.78, 0, 0],
        rightLowerArm: [-0.78, 0, 0],
        leftUpperLeg: [0.12 * step, 0.2 * step, 0],
        rightUpperLeg: [-0.12 * step, -0.2 * step, 0],
      };
    case 'charleston-step':
      return {
        hips: [0.1, 0.1 * step, 0],
        chest: [-0.08, -0.08 * step, 0],
        leftUpperArm: [-0.5 + 0.28 * step, 0, -0.2],
        rightUpperArm: [-0.5 - 0.28 * step, 0, 0.2],
        leftUpperLeg: [0.62 * step, 0, 0],
        rightUpperLeg: [-0.62 * step, 0, 0],
        leftLowerLeg: [0.58 * Math.max(0, step), 0, 0],
        rightLowerLeg: [0.58 * Math.max(0, -step), 0, 0],
        leftFoot: [0.34 * step, 0, 0],
        rightFoot: [-0.34 * step, 0, 0],
      };
    case 'side-shuffle':
      return {
        hips: [0.08 + 0.08 * Math.abs(b), 0, -0.2 * step],
        chest: [-0.06, 0, 0.14 * step],
        leftUpperArm: [-0.42 - 0.24 * step, 0, -0.24],
        rightUpperArm: [-0.42 + 0.24 * step, 0, 0.24],
        leftUpperLeg: [0.28 * step, 0, 0.18 * step],
        rightUpperLeg: [-0.28 * step, 0, 0.18 * step],
        leftLowerLeg: [0.36 * Math.max(0, -step), 0, 0],
        rightLowerLeg: [0.36 * Math.max(0, step), 0, 0],
      };
    case 'grapevine-step':
      return {
        hips: [0.05, 0.18 * step, -0.16 * step],
        chest: [-0.04, -0.12 * step, 0.12 * step],
        leftUpperArm: [-0.38 - 0.18 * step, 0, -0.48],
        rightUpperArm: [-0.38 + 0.18 * step, 0, 0.48],
        leftUpperLeg: [0.18 * step, 0.22 * step, 0.2 * step],
        rightUpperLeg: [-0.18 * step, -0.22 * step, 0.2 * step],
      };
    case 'jazz-square': {
      const phase = (time * 1.1) % 1;
      const quarter = Math.floor(phase * 4);
      const local = ease((phase * 4) % 1);
      const left = quarter === 0 || quarter === 3 ? local : 1 - local;
      const forward = quarter < 2 ? local : 1 - local;
      return {
        hips: [0.06, 0.16 * (left - 0.5), -0.12 * (left - 0.5)],
        chest: [-0.05, -0.1 * (left - 0.5), 0.08 * (left - 0.5)],
        leftUpperArm: [-0.45, 0, -0.42],
        rightUpperArm: [-0.45, 0, 0.42],
        leftUpperLeg: [0.35 * (forward - 0.5), 0.2 * (left - 0.5), 0],
        rightUpperLeg: [-0.35 * (forward - 0.5), -0.2 * (left - 0.5), 0],
      };
    }
    case 'box-step':
      return {
        hips: [0.05, 0.12 * step, -0.1 * step],
        chest: [-0.04, -0.08 * step, 0.08 * step],
        leftUpperArm: [-0.56, 0, -0.36],
        rightUpperArm: [-0.56, 0, 0.36],
        leftLowerArm: [-0.72, 0, 0],
        rightLowerArm: [-0.72, 0, 0],
        leftUpperLeg: [0.38 * step, 0, 0.12 * step],
        rightUpperLeg: [-0.38 * step, 0, 0.12 * step],
      };
    case 'mambo-step':
      return {
        hips: [0.06, 0.22 * step, -0.18 * step],
        chest: [-0.05, -0.13 * step, 0.1 * step],
        leftUpperArm: [-0.5 - 0.15 * step, 0, -0.28],
        rightUpperArm: [-0.5 + 0.15 * step, 0, 0.28],
        leftUpperLeg: [0.48 * step, 0, 0],
        rightUpperLeg: [-0.36 * step, 0, 0],
        leftLowerLeg: [0.28 * Math.max(0, -step), 0, 0],
        rightLowerLeg: [0.28 * Math.max(0, step), 0, 0],
      };
    case 'cha-cha': {
      const quick = wave(time, 2.7);
      return {
        hips: [0.05, 0.2 * quick, -0.2 * step],
        chest: [-0.04, -0.1 * quick, 0.1 * step],
        leftUpperArm: [-0.48, 0, -0.4 - 0.08 * quick],
        rightUpperArm: [-0.48, 0, 0.4 - 0.08 * quick],
        leftUpperLeg: [0.3 * step, 0.1 * quick, 0],
        rightUpperLeg: [-0.3 * step, -0.1 * quick, 0],
      };
    }
    case 'arm-wave':
      return {
        chest: [0, 0.08 * wave(time, 0.5), 0],
        leftUpperArm: [-0.35, 0, -1.18],
        leftLowerArm: [-0.25 - 0.4 * wave(time, 0.75, 1.4), 0, 0],
        leftHand: [0, 0, 0.34 * wave(time, 0.75, 2.2)],
        rightUpperArm: [-0.35, 0, 1.18],
        rightLowerArm: [-0.25 - 0.4 * wave(time, 0.75, 4.5), 0, 0],
        rightHand: [0, 0, 0.34 * wave(time, 0.75, 5.4)],
        head: [0.03 * b, -0.06 * sway, 0],
      };
    case 'freestyle-groove':
      return {
        hips: [0.1 + 0.08 * Math.abs(b), 0.22 * step, -0.16 * wave(time, 1.2)],
        spine: [-0.05 * b, -0.12 * step, 0],
        chest: [-0.1 - 0.06 * Math.abs(b), -0.15 * step, 0.16 * step],
        head: [0.08 * wave(time, 0.9), 0.1 * sway, -0.05 * step],
        leftUpperArm: [-0.62 - 0.36 * step, 0, -0.36],
        rightUpperArm: [-0.62 + 0.36 * step, 0, 0.36],
        leftLowerArm: [-0.82 + 0.24 * b, 0, 0],
        rightLowerArm: [-0.82 - 0.24 * b, 0, 0],
        leftUpperLeg: [0.42 * step, 0, 0.12 * step],
        rightUpperLeg: [-0.42 * step, 0, 0.12 * step],
        leftLowerLeg: [0.35 * Math.max(0, -step), 0, 0],
        rightLowerLeg: [0.35 * Math.max(0, step), 0, 0],
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

export function sampleProceduralRoot(
  preset: ProceduralPreset,
  time: number,
): ProceduralRootMotion {
  const step = wave(time, 1.8);
  const bounce = Math.abs(beat(time, 112));
  if (preset === 'spin-celebration') {
    return { position: [0, 0.05 * bounce, 0], yaw: time * 1.9 };
  }
  if (preset === 'juke-left-right') {
    return { position: [0.16 * step, 0.04 * bounce, 0], yaw: -0.14 * step };
  }
  if (preset === 'side-shuffle' || preset === 'grapevine-step') {
    return { position: [0.13 * step, 0.04 * bounce, 0], yaw: 0.08 * step };
  }
  if (
    preset === 'running-man' ||
    preset === 'griddy-celebration' ||
    preset === 'charleston-step'
  ) {
    return { position: [0.05 * step, 0.07 * bounce, 0], yaw: 0.08 * step };
  }
  if (
    preset === 'two-step' ||
    preset === 'heel-toe-shuffle' ||
    preset === 'moonwalk-glide' ||
    preset === 'salsa-basic' ||
    preset === 'disco-point' ||
    preset === 'hip-hop-bounce' ||
    preset === 'the-twist' ||
    preset === 'jazz-square' ||
    preset === 'box-step' ||
    preset === 'mambo-step' ||
    preset === 'cha-cha' ||
    preset === 'arm-wave' ||
    preset === 'freestyle-groove' ||
    preset === 'robot-pop' ||
    preset === 'body-wave'
  ) {
    return {
      position: [0.07 * step, 0.045 * bounce, 0],
      yaw: 0.1 * step,
    };
  }
  return {
    position: [0, 0.012 * Math.max(0, wave(time, 0.45)), 0],
    yaw: 0,
  };
}
