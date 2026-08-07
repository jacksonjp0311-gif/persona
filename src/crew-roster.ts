export const MAX_CREW_SIZE = 4;

type CrewSettingsSnapshot = Pick<
  PersonaSettingsSnapshot,
  'default_model_id' | 'deployed_model_ids' | 'deployment_mode' | 'models'
>;

/**
 * Resolves the persisted deployment into installed models while preserving
 * roster order. The first returned model is the crew leader and voice face.
 */
export function resolveDeployedModels(
  snapshot: CrewSettingsSnapshot,
): PersonaModelSettings[] {
  const modelsById = new Map(
    snapshot.models.map((model) => [model.id, model] as const),
  );
  const requestedIds =
    snapshot.deployed_model_ids.length > 0
      ? snapshot.deployed_model_ids
      : snapshot.default_model_id == null
        ? []
        : [snapshot.default_model_id];
  const limit = snapshot.deployment_mode === 'crew' ? MAX_CREW_SIZE : 1;
  const seen = new Set<string>();
  const deployed: PersonaModelSettings[] = [];

  for (const modelId of requestedIds) {
    if (seen.has(modelId)) continue;
    seen.add(modelId);
    const model = modelsById.get(modelId);
    if (!model) continue;
    deployed.push(model);
    if (deployed.length === limit) break;
  }

  if (deployed.length > 0) return deployed;
  const fallback =
    snapshot.default_model_id == null
      ? undefined
      : modelsById.get(snapshot.default_model_id);
  return fallback ? [fallback] : [];
}
