import { describe, expect, it } from 'vitest';
import { MAX_CREW_SIZE, resolveDeployedModels } from './crew-roster';

function model(id: string): PersonaModelSettings {
  return {
    asset_url: `./${id}.vrm`,
    id,
    model_name: id,
    origin: 'packaged',
    removable: false,
  };
}

describe('resolveDeployedModels', () => {
  it('preserves crew order, removes duplicates, and ignores missing models', () => {
    const models = ['leader', 'second', 'third'].map(model);
    expect(
      resolveDeployedModels({
        default_model_id: 'leader',
        deployed_model_ids: ['second', 'missing', 'second', 'leader', 'third'],
        deployment_mode: 'crew',
        models,
      }).map(({ id }) => id),
    ).toEqual(['second', 'leader', 'third']);
  });

  it('limits solo deployments to one model', () => {
    const models = ['leader', 'second'].map(model);
    expect(
      resolveDeployedModels({
        default_model_id: 'leader',
        deployed_model_ids: ['second', 'leader'],
        deployment_mode: 'solo',
        models,
      }).map(({ id }) => id),
    ).toEqual(['second']);
  });

  it('falls back to the legacy default and caps crew size', () => {
    const models = ['one', 'two', 'three', 'four', 'five'].map(model);
    expect(
      resolveDeployedModels({
        default_model_id: 'one',
        deployed_model_ids: [],
        deployment_mode: 'solo',
        models,
      }).map(({ id }) => id),
    ).toEqual(['one']);
    expect(
      resolveDeployedModels({
        default_model_id: 'one',
        deployed_model_ids: models.map(({ id }) => id),
        deployment_mode: 'crew',
        models,
      }),
    ).toHaveLength(MAX_CREW_SIZE);
  });
});
