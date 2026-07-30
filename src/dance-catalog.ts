/**
 * Compact, battle-tested dance set for the desktop hover wheel.
 * Procedural-only entries stay reliable across VRM body proportions.
 */
export const FEATURED_DANCE_IDS = [
  'dance-freestyle-groove',
  'dance-hip-hop-bounce',
  'dance-justice-bounce',
  'dance-floss-swing',
  'dance-running-man',
  'dance-robot-pop',
  'dance-two-step',
  'dance-say-so-bounce',
] as const;

export type FeaturedDanceId = (typeof FEATURED_DANCE_IDS)[number];

export function isFeaturedDanceId(id: string): id is FeaturedDanceId {
  return (FEATURED_DANCE_IDS as readonly string[]).includes(id);
}

/** Short labels that fit the glass wheel chips. */
export const FEATURED_DANCE_LABELS: Record<FeaturedDanceId, string> = {
  'dance-freestyle-groove': 'Freestyle',
  'dance-hip-hop-bounce': 'Hip Hop',
  'dance-justice-bounce': 'Justice',
  'dance-floss-swing': 'Floss',
  'dance-running-man': 'Run Man',
  'dance-robot-pop': 'Robot',
  'dance-two-step': 'Two Step',
  'dance-say-so-bounce': 'Say So',
};

/**
 * Prefer procedural motion for dances. Captured VRMA clips vary wildly by
 * avatar skeleton and often face the wrong way on packaged models.
 */
export function dancePlaybackUrls(
  animationUrls: readonly string[],
  proceduralPreset: string | null | undefined,
): string[] {
  if (proceduralPreset) return [];
  return [...animationUrls];
}
