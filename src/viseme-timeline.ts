export const MOUTH_VISEMES = ['aa', 'ee', 'ih', 'oh', 'ou'] as const;

export type MouthViseme = (typeof MOUTH_VISEMES)[number];

export interface VisemeCue {
  charIndex: number;
  durationMs: number;
  startMs: number;
  viseme: MouthViseme | null;
  weight: number;
}

export type VisemeWeights = Record<MouthViseme, number>;

const ZERO_WEIGHTS: VisemeWeights = {
  aa: 0,
  ee: 0,
  ih: 0,
  oh: 0,
  ou: 0,
};

const DIGRAPHS: Readonly<Record<string, MouthViseme>> = {
  ai: 'aa',
  ay: 'aa',
  ea: 'ee',
  ee: 'ee',
  ie: 'ee',
  oa: 'oh',
  oo: 'ou',
  ou: 'ou',
  ow: 'oh',
  ue: 'ou',
};

const LETTER_VISEMES: Readonly<Record<string, MouthViseme>> = {
  a: 'aa',
  e: 'ee',
  i: 'ih',
  o: 'oh',
  u: 'ou',
  w: 'ou',
  y: 'ih',
};

const DIGIT_VISEMES: Readonly<Record<string, MouthViseme>> = {
  '0': 'oh',
  '1': 'ou',
  '2': 'ou',
  '3': 'ee',
  '4': 'oh',
  '5': 'ih',
  '6': 'ih',
  '7': 'ee',
  '8': 'aa',
  '9': 'ih',
};

function boundedRate(rate: number): number {
  return Number.isFinite(rate) ? Math.max(0.5, Math.min(2, rate)) : 1;
}

function pauseDuration(character: string): number {
  if (/[.!?]/.test(character)) return 170;
  if (/[,;:]/.test(character)) return 100;
  if (/\s/.test(character)) return 28;
  return 42;
}

function cueDuration(
  viseme: MouthViseme | null,
  character: string,
  pair: boolean,
): number {
  if (viseme == null) return pauseDuration(character);
  return pair ? 150 : 105;
}

export function createVisemeTimeline(
  text: string,
  rate = 1,
): VisemeCue[] {
  const speed = boundedRate(rate);
  const cues: VisemeCue[] = [];
  let startMs = 0;

  function append(
    charIndex: number,
    character: string,
    viseme: MouthViseme | null,
    pair = false,
  ) {
    const durationMs = cueDuration(viseme, character, pair) / speed;
    const previous = cues.at(-1);
    if (
      previous &&
      previous.viseme === viseme &&
      previous.startMs + previous.durationMs === startMs
    ) {
      previous.durationMs += durationMs;
    } else {
      cues.push({
        charIndex,
        durationMs,
        startMs,
        viseme,
        weight: viseme == null ? 0 : pair ? 0.9 : 0.82,
      });
    }
    startMs += durationMs;
  }

  const normalized = text.toLowerCase();
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const pair = normalized.slice(index, index + 2);
    const pairViseme = DIGRAPHS[pair];
    if (pairViseme) {
      append(index, pair, pairViseme, true);
      index += 1;
      continue;
    }
    const viseme =
      LETTER_VISEMES[character] ??
      DIGIT_VISEMES[character] ??
      null;
    append(index, character, viseme);
  }
  return cues;
}

function addWeight(
  target: VisemeWeights,
  cue: VisemeCue | undefined,
  amount: number,
) {
  if (cue?.viseme == null || amount <= 0) return;
  target[cue.viseme] = Math.min(
    1,
    target[cue.viseme] + cue.weight * amount,
  );
}

export function visemeWeightsAt(
  cues: readonly VisemeCue[],
  elapsedMs: number,
  transitionMs = 45,
): VisemeWeights {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || cues.length === 0) {
    return { ...ZERO_WEIGHTS };
  }
  const index = cues.findIndex(
    (cue) =>
      elapsedMs >= cue.startMs &&
      elapsedMs < cue.startMs + cue.durationMs,
  );
  if (index < 0) return { ...ZERO_WEIGHTS };

  const current = cues[index];
  const previous = cues[index - 1];
  const next = cues[index + 1];
  const weights = { ...ZERO_WEIGHTS };
  const transition = Math.max(
    1,
    Math.min(
      transitionMs,
      current.durationMs / 2,
    ),
  );
  const intoCue = elapsedMs - current.startMs;
  const remaining = current.startMs + current.durationMs - elapsedMs;

  if (intoCue < transition) {
    const blend = intoCue / transition;
    addWeight(weights, previous, 1 - blend);
    addWeight(weights, current, blend);
  } else if (remaining < transition) {
    const blend = 1 - remaining / transition;
    addWeight(weights, current, 1 - blend);
    addWeight(weights, next, blend);
  } else {
    addWeight(weights, current, 1);
  }
  return weights;
}

export function visemeTimelineDuration(
  cues: readonly VisemeCue[],
): number {
  const last = cues.at(-1);
  return last ? last.startMs + last.durationMs : 0;
}
