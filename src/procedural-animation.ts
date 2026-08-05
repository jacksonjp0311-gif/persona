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
  'justice-bounce',
  'floss-swing',
  'electro-shuffle',
  'take-the-l',
  'hammer-fresh',
  'renegade-hit',
  'say-so-bounce',
  'pony-gallop',
  'whip-nae',
  'carlton-bounce',
  'macarena-wave',
  'thriller-walk',
  'toosie-slide',
  'scenario-groove',
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
  'justice-bounce': 4.2,
  'floss-swing': 3.8,
  'electro-shuffle': 4,
  'take-the-l': 3.6,
  'hammer-fresh': 4,
  'renegade-hit': 4.2,
  'say-so-bounce': 4,
  'pony-gallop': 3.8,
  'whip-nae': 4.4,
  'carlton-bounce': 4,
  'macarena-wave': 5.2,
  'thriller-walk': 4.2,
  'toosie-slide': 4,
  'scenario-groove': 4.2,
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
  // Full weight immediately for loops so deploy never looks frozen.
  // Brief ease-in still softens the first frames of a switch.
  const easeIn = ease(Math.min(1, Math.max(0, elapsed / 0.15)));
  if (playback === 'loop') return Math.max(0.85, easeIn);
  const remaining = Math.max(0, duration - elapsed);
  const easeOut = ease(Math.min(1, remaining / 0.18));
  return Math.max(0.5, easeIn * easeOut);
}

type Vec3 = readonly [number, number, number];
const vec = (x: number, y: number, z: number): Vec3 => [x, y, z];
const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * Soften harsh sign snaps so beat-synced dances do not pop into broken poses.
 */
function softSnap(time: number, bpm = 110): number {
  return Math.tanh(beat(time, bpm) * 2.2);
}

/**
 * One smooth full-body dance recipe. Every dance is a parameter pack on this
 * so limbs stay coherent, camera-facing, and free of extreme joint snaps.
 */
function smoothDance(
  time: number,
  {
    bpm = 112,
    bounce = 0.09,
    stepAmp = 0.16,
    armSwing = 0.22,
    armLift = 0,
    knee = 0.2,
    chestAmp = 0.06,
    headAmp = 0.04,
    style = 'groove',
  }: {
    bpm?: number;
    bounce?: number;
    stepAmp?: number;
    armSwing?: number;
    armLift?: number;
    knee?: number;
    chestAmp?: number;
    headAmp?: number;
    style?:
      | 'groove'
      | 'floss'
      | 'robot'
      | 'run'
      | 'wave'
      | 'point'
      | 'justice'
      | 'twist';
  } = {},
): ProceduralPose {
  const b = Math.abs(beat(time, bpm));
  const step = wave(time, bpm / 60);
  const arm = wave(time, bpm / 60, 0.2);
  const rest = RELAXED_REST_POSE;
  const hipBounce = bounce * b;
  const kneeBend = knee * b;

  let leftArm = addVec(rest.leftUpperArm!, vec(-armLift * b, 0, -armSwing * arm));
  let rightArm = addVec(rest.rightUpperArm!, vec(-armLift * b, 0, armSwing * arm));
  let leftFore = addVec(rest.leftLowerArm!, vec(-0.08 * b, 0, 0));
  let rightFore = addVec(rest.rightLowerArm!, vec(-0.08 * b, 0, 0));
  let leftLeg = addVec(rest.leftUpperLeg!, vec(stepAmp * step, 0, 0.03 * step));
  let rightLeg = addVec(rest.rightUpperLeg!, vec(-stepAmp * step, 0, 0.03 * step));
  let leftKnee = addVec(rest.leftLowerLeg!, vec(kneeBend + 0.18 * Math.max(0, -step), 0, 0));
  let rightKnee = addVec(rest.rightLowerLeg!, vec(kneeBend + 0.18 * Math.max(0, step), 0, 0));
  let chest = addVec(rest.chest!, vec(-chestAmp * b, -0.03 * step, 0.04 * step));
  let hips = addVec(rest.hips!, vec(0.04 + hipBounce, 0.035 * step, 0));
  let head = addVec(rest.head!, vec(headAmp * b, 0.04 * step, 0));

  if (style === 'floss') {
    const swing = wave(time, 1.45);
    leftArm = addVec(rest.leftUpperArm!, vec(-0.08, 0, -0.12 - 0.42 * swing));
    rightArm = addVec(rest.rightUpperArm!, vec(-0.08, 0, 0.12 + 0.42 * swing));
    leftFore = addVec(rest.leftLowerArm!, vec(-0.12 - 0.2 * swing, 0, 0));
    rightFore = addVec(rest.rightLowerArm!, vec(-0.12 + 0.2 * swing, 0, 0));
    hips = addVec(rest.hips!, vec(0.04 + 0.03 * b, 0.04 * swing, 0));
    chest = addVec(rest.chest!, vec(-0.03, -0.03 * swing, 0));
  } else if (style === 'robot') {
    const snap = softSnap(time, bpm);
    leftArm = addVec(rest.leftUpperArm!, vec(-0.35, 0.1 * snap, 0.08));
    rightArm = addVec(rest.rightUpperArm!, vec(-0.35, -0.1 * snap, -0.08));
    leftFore = addVec(rest.leftLowerArm!, vec(-0.35 + 0.12 * snap, 0, 0));
    rightFore = addVec(rest.rightLowerArm!, vec(-0.35 - 0.12 * snap, 0, 0));
    chest = addVec(rest.chest!, vec(0.06 * snap, 0.05 * snap, 0));
    head = addVec(rest.head!, vec(-0.04 * snap, -0.04 * snap, 0));
    leftLeg = addVec(rest.leftUpperLeg!, vec(0.04, 0, -0.03));
    rightLeg = addVec(rest.rightUpperLeg!, vec(0.04, 0, 0.03));
    leftKnee = addVec(rest.leftLowerLeg!, vec(0.1, 0, 0));
    rightKnee = addVec(rest.rightLowerLeg!, vec(0.1, 0, 0));
  } else if (style === 'run') {
    leftArm = addVec(rest.leftUpperArm!, vec(-0.2 - 0.28 * step, 0, 0.05));
    rightArm = addVec(rest.rightUpperArm!, vec(-0.2 + 0.28 * step, 0, -0.05));
    leftFore = addVec(rest.leftLowerArm!, vec(-0.2 + 0.1 * step, 0, 0));
    rightFore = addVec(rest.rightLowerArm!, vec(-0.2 - 0.1 * step, 0, 0));
    leftLeg = addVec(rest.leftUpperLeg!, vec(0.32 * step, 0, 0));
    rightLeg = addVec(rest.rightUpperLeg!, vec(-0.32 * step, 0, 0));
    leftKnee = addVec(rest.leftLowerLeg!, vec(0.35 * Math.max(0, -step) + 0.08 * b, 0, 0));
    rightKnee = addVec(rest.rightLowerLeg!, vec(0.35 * Math.max(0, step) + 0.08 * b, 0, 0));
  } else if (style === 'wave') {
    const w = wave(time, 0.75);
    hips = addVec(rest.hips!, vec(0.08 * wave(time, 0.75, 2.2), 0, 0));
    chest = addVec(rest.chest!, vec(0.1 * wave(time, 0.75, 0.9), 0, 0));
    head = addVec(rest.head!, vec(0.05 * w, 0, 0));
    leftArm = addVec(rest.leftUpperArm!, vec(0.05, 0, 0.15));
    rightArm = addVec(rest.rightUpperArm!, vec(0.05, 0, -0.15));
  } else if (style === 'point') {
    const lift = pulse(time, 0.9);
    rightArm = addVec(rest.rightUpperArm!, vec(-0.85 * lift, 0, -0.15));
    rightFore = addVec(rest.rightLowerArm!, vec(0.35 * lift, 0, 0));
    leftArm = addVec(rest.leftUpperArm!, vec(0.05, 0, 0.12));
    hips = addVec(rest.hips!, vec(0.05 + 0.04 * b, 0.05 * step, 0));
  } else if (style === 'justice') {
    const lift = pulse(time, 1.1);
    leftArm = addVec(rest.leftUpperArm!, vec(-0.55 - 0.55 * lift, 0, 0.08));
    rightArm = addVec(rest.rightUpperArm!, vec(-0.55 - 0.55 * lift, 0, -0.08));
    leftFore = addVec(rest.leftLowerArm!, vec(-0.15 - 0.35 * lift, 0, 0));
    rightFore = addVec(rest.rightLowerArm!, vec(-0.15 - 0.35 * lift, 0, 0));
    leftKnee = addVec(rest.leftLowerLeg!, vec(0.28 * b, 0, 0));
    rightKnee = addVec(rest.rightLowerLeg!, vec(0.28 * b, 0, 0));
    hips = addVec(rest.hips!, vec(0.06 + 0.1 * b, 0.03 * step, 0));
  } else if (style === 'twist') {
    hips = addVec(rest.hips!, vec(0.05 + 0.04 * b, 0.1 * step, 0.06 * step));
    chest = addVec(rest.chest!, vec(-0.04, -0.08 * step, 0.05 * step));
    leftArm = addVec(rest.leftUpperArm!, vec(-0.05, 0, 0.08 * step));
    rightArm = addVec(rest.rightUpperArm!, vec(-0.05, 0, -0.08 * step));
  }

  return {
    hips,
    spine: addVec(rest.spine!, vec(-0.02 * b, -0.02 * step, 0)),
    chest,
    neck: addVec(rest.neck!, vec(0.01 * b, 0.02 * step, 0)),
    head,
    leftUpperArm: leftArm,
    rightUpperArm: rightArm,
    leftLowerArm: leftFore,
    rightLowerArm: rightFore,
    leftUpperLeg: leftLeg,
    rightUpperLeg: rightLeg,
    leftLowerLeg: leftKnee,
    rightLowerLeg: rightKnee,
  };
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
      return smoothDance(time, { bpm: 118, bounce: 0.1, stepAmp: 0.22, armSwing: 0.28, knee: 0.22, style: 'run' });
    case 'two-step':
      return smoothDance(time, { bpm: 108, bounce: 0.08, stepAmp: 0.14, armSwing: 0.16, knee: 0.16 });
    case 'running-man':
      return smoothDance(time, { bpm: 120, bounce: 0.07, stepAmp: 0.28, armSwing: 0.2, knee: 0.24, style: 'run' });
    case 'heel-toe-shuffle':
      return smoothDance(time, { bpm: 112, bounce: 0.07, stepAmp: 0.12, armSwing: 0.12, knee: 0.14 });
    case 'robot-pop':
      return smoothDance(time, { bpm: 100, bounce: 0.05, stepAmp: 0.06, armSwing: 0.1, knee: 0.1, style: 'robot' });
    case 'body-wave':
      return smoothDance(time, { bpm: 96, bounce: 0.05, stepAmp: 0.06, armSwing: 0.08, style: 'wave' });
    case 'moonwalk-glide':
      return smoothDance(time, { bpm: 100, bounce: 0.05, stepAmp: 0.12, armSwing: 0.1, knee: 0.18 });
    case 'salsa-basic':
      return smoothDance(time, { bpm: 118, bounce: 0.07, stepAmp: 0.18, armSwing: 0.14, knee: 0.14 });
    case 'disco-point':
      return smoothDance(time, { bpm: 112, bounce: 0.07, stepAmp: 0.12, armSwing: 0.1, style: 'point' });
    case 'hip-hop-bounce':
      return smoothDance(time, { bpm: 112, bounce: 0.11, stepAmp: 0.14, armSwing: 0.2, knee: 0.2 });
    case 'spin-celebration':
      return smoothDance(time, { bpm: 116, bounce: 0.08, stepAmp: 0.1, armSwing: 0.18, armLift: 0.15, knee: 0.14 });
    case 'the-twist':
      return smoothDance(time, { bpm: 120, bounce: 0.08, stepAmp: 0.12, armSwing: 0.12, style: 'twist' });
    case 'charleston-step':
      return smoothDance(time, { bpm: 124, bounce: 0.07, stepAmp: 0.24, armSwing: 0.2, knee: 0.22, style: 'run' });
    case 'side-shuffle':
      return smoothDance(time, { bpm: 118, bounce: 0.08, stepAmp: 0.16, armSwing: 0.18, knee: 0.16 });
    case 'grapevine-step':
      return smoothDance(time, { bpm: 112, bounce: 0.07, stepAmp: 0.15, armSwing: 0.16, knee: 0.15 });
    case 'jazz-square':
      return smoothDance(time, { bpm: 108, bounce: 0.06, stepAmp: 0.14, armSwing: 0.12, knee: 0.14 });
    case 'box-step':
      return smoothDance(time, { bpm: 100, bounce: 0.05, stepAmp: 0.12, armSwing: 0.1, knee: 0.12 });
    case 'mambo-step':
      return smoothDance(time, { bpm: 118, bounce: 0.07, stepAmp: 0.18, armSwing: 0.14, knee: 0.16 });
    case 'cha-cha':
      return smoothDance(time, { bpm: 124, bounce: 0.07, stepAmp: 0.16, armSwing: 0.14, knee: 0.14 });
    case 'arm-wave':
      return smoothDance(time, { bpm: 100, bounce: 0.04, stepAmp: 0.05, armSwing: 0.28, armLift: 0.12, style: 'wave' });
    case 'freestyle-groove':
      return smoothDance(time, { bpm: 114, bounce: 0.1, stepAmp: 0.18, armSwing: 0.24, knee: 0.2 });
    case 'justice-bounce':
      return smoothDance(time, { bpm: 118, bounce: 0.12, stepAmp: 0.1, armSwing: 0.12, knee: 0.24, style: 'justice' });
    case 'floss-swing':
      return smoothDance(time, { bpm: 116, bounce: 0.06, stepAmp: 0.08, armSwing: 0.35, style: 'floss' });
    case 'electro-shuffle':
      return smoothDance(time, { bpm: 126, bounce: 0.08, stepAmp: 0.16, armSwing: 0.18, knee: 0.16, style: 'robot' });
    case 'take-the-l':
      return smoothDance(time, { bpm: 108, bounce: 0.09, stepAmp: 0.1, armSwing: 0.12, knee: 0.16, style: 'point' });
    case 'hammer-fresh':
      return smoothDance(time, { bpm: 112, bounce: 0.09, stepAmp: 0.12, armSwing: 0.2, knee: 0.18 });
    case 'renegade-hit':
      return smoothDance(time, { bpm: 114, bounce: 0.09, stepAmp: 0.16, armSwing: 0.22, knee: 0.18 });
    case 'say-so-bounce':
      return smoothDance(time, { bpm: 104, bounce: 0.09, stepAmp: 0.12, armSwing: 0.16, knee: 0.16 });
    case 'pony-gallop':
      return smoothDance(time, { bpm: 120, bounce: 0.08, stepAmp: 0.26, armSwing: 0.22, knee: 0.22, style: 'run' });
    case 'whip-nae':
      return smoothDance(time, { bpm: 116, bounce: 0.1, stepAmp: 0.12, armSwing: 0.2, knee: 0.18, style: 'justice' });
    case 'carlton-bounce':
      return smoothDance(time, { bpm: 108, bounce: 0.1, stepAmp: 0.08, armSwing: 0.12, armLift: 0.35, knee: 0.16 });
    case 'macarena-wave':
      return smoothDance(time, { bpm: 104, bounce: 0.06, stepAmp: 0.1, armSwing: 0.2, armLift: 0.1, style: 'wave' });
    case 'thriller-walk':
      return smoothDance(time, { bpm: 96, bounce: 0.05, stepAmp: 0.14, armSwing: 0.1, knee: 0.14, style: 'robot' });
    case 'toosie-slide':
      return smoothDance(time, { bpm: 112, bounce: 0.07, stepAmp: 0.16, armSwing: 0.14, knee: 0.14, style: 'point' });
    case 'scenario-groove':
      return smoothDance(time, { bpm: 118, bounce: 0.1, stepAmp: 0.16, armSwing: 0.22, knee: 0.18 });
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

/** Root yaw is disabled for dances — facing is locked in the animation hook. */
export const MAX_DANCE_ROOT_YAW = 0;


const DANCE_PRESETS = new Set<ProceduralPreset>([
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
  'justice-bounce',
  'floss-swing',
  'electro-shuffle',
  'take-the-l',
  'hammer-fresh',
  'renegade-hit',
  'say-so-bounce',
  'pony-gallop',
  'whip-nae',
  'carlton-bounce',
  'macarena-wave',
  'thriller-walk',
  'toosie-slide',
  'scenario-groove',
]);

export function sampleProceduralRoot(
  preset: ProceduralPreset,
  time: number,
): ProceduralRootMotion {
  const step = wave(time, 1.8);
  const bounce = Math.abs(beat(time, 112));
  // Dances: vertical bounce only. Lateral root motion + yaw made characters
  // walk off-frame or face away on many VRM bodies.
  if (DANCE_PRESETS.has(preset) || preset === 'spin-celebration') {
    return {
      position: [0, 0.035 + 0.04 * bounce, 0],
      yaw: 0,
    };
  }
  if (preset === 'juke-left-right') {
    return { position: [0.08 * step, 0.03 * bounce, 0], yaw: 0 };
  }
  return {
    position: [0, 0.012 * Math.max(0, wave(time, 0.45)), 0],
    yaw: 0,
  };
}

/**
 * Clamp torso yaw accents so procedural dances never face fully away.
 */
export function frontFacingProceduralPose(pose: ProceduralPose): ProceduralPose {
  // Tight yaw limits keep dancers camera-forward without freezing sway.
  const maxBoneYaw = 0.18;
  const clampAxis = (
    rotation: readonly [number, number, number] | undefined,
  ): readonly [number, number, number] | undefined => {
    if (!rotation) return rotation;
    return [
      rotation[0],
      Math.min(maxBoneYaw, Math.max(-maxBoneYaw, rotation[1])),
      rotation[2],
    ];
  };
  return {
    ...pose,
    hips: clampAxis(pose.hips) ?? pose.hips,
    spine: clampAxis(pose.spine) ?? pose.spine,
    chest: clampAxis(pose.chest) ?? pose.chest,
    upperChest: clampAxis(pose.upperChest) ?? pose.upperChest,
    neck: clampAxis(pose.neck) ?? pose.neck,
    head: clampAxis(pose.head) ?? pose.head,
  };
}
