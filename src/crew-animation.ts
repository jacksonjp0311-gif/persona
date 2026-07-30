/**
 * Chooses one clip for the whole crew. Passing the resulting one-item array to
 * every Avatar prevents their independent animation hooks from picking
 * different clips from the same action.
 */
export function chooseSynchronizedAnimationUrls(
  animationUrls: readonly string[],
  random: () => number = Math.random,
): string[] {
  const candidates = animationUrls.filter((url) => url.length > 0);
  if (candidates.length === 0) return [];
  const sampled = random();
  const unit = Number.isFinite(sampled)
    ? Math.min(0.999999, Math.max(0, sampled))
    : 0;
  return [candidates[Math.floor(unit * candidates.length)]];
}
