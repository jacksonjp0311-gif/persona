"use strict";

function snapshotHasConfiguredModel(snapshot) {
  const configuredModelIds =
    Array.isArray(snapshot?.deployed_model_ids) &&
    snapshot.deployed_model_ids.length > 0
      ? snapshot.deployed_model_ids
      : snapshot?.default_model_id == null
        ? []
        : [snapshot.default_model_id];
  return (
    Array.isArray(snapshot?.models) &&
    configuredModelIds.some((modelId) =>
      snapshot.models.some((model) => model?.id === modelId),
    )
  );
}

module.exports = { snapshotHasConfiguredModel };
