import { MAX_CREW_SIZE } from './crew-roster';

export function toggleCrewMember(
  selectedIds: readonly string[],
  modelId: string,
): string[] {
  if (selectedIds.includes(modelId)) {
    return selectedIds.filter((id) => id !== modelId);
  }
  if (selectedIds.length >= MAX_CREW_SIZE) return [...selectedIds];
  return [...selectedIds, modelId];
}

export function sameCrew(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((modelId, index) => modelId === right[index])
  );
}

export function randomCrew(
  modelIds: readonly string[],
  count = MAX_CREW_SIZE,
  random: () => number = Math.random,
): string[] {
  const unique = [...new Set(modelIds)];
  for (let index = unique.length - 1; index > 0; index -= 1) {
    const sampled = random();
    const unit = Number.isFinite(sampled)
      ? Math.min(0.999999, Math.max(0, sampled))
      : 0;
    const swapIndex = Math.floor(unit * (index + 1));
    [unique[index], unique[swapIndex]] = [
      unique[swapIndex],
      unique[index],
    ];
  }
  return unique.slice(
    0,
    Math.max(0, Math.min(MAX_CREW_SIZE, Math.floor(count))),
  );
}
