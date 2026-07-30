import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  MAX_FRONT_FACING_YAW,
  facingYaw,
  stabilizeFacingTrack,
  stabilizeFacingValues,
} from './front-facing-motion';

function quaternionValues(...eulers: THREE.Euler[]): Float32Array {
  return Float32Array.from(
    eulers.flatMap((euler) =>
      new THREE.Quaternion().setFromEuler(euler).toArray(),
    ),
  );
}

describe('front-facing motion stabilization', () => {
  it('prevents captured clips from turning their back to the camera', () => {
    const values = stabilizeFacingValues(
      quaternionValues(
        new THREE.Euler(0, 0, 0),
        new THREE.Euler(0, Math.PI / 2, 0),
        new THREE.Euler(0, Math.PI, 0),
      ),
    );

    for (let offset = 0; offset < values.length; offset += 4) {
      const yaw = Math.abs(
        facingYaw(new THREE.Quaternion().fromArray(values, offset)),
      );
      expect(yaw).toBeLessThanOrEqual(MAX_FRONT_FACING_YAW + 1e-5);
    }
  });

  it('retains natural pitch and roll while limiting only the heading', () => {
    const source = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.22, Math.PI, -0.16, 'XYZ'),
    );
    const stabilized = new THREE.Quaternion().fromArray(
      stabilizeFacingValues(Float32Array.from(source.toArray())),
    );
    const sourceForwardTilt = new THREE.Vector3(0, 1, 0).applyQuaternion(
      source,
    );
    const stabilizedForwardTilt = new THREE.Vector3(
      0,
      1,
      0,
    ).applyQuaternion(stabilized);

    expect(stabilizedForwardTilt.angleTo(sourceForwardTilt)).toBeLessThan(
      1e-5,
    );
  });

  it('clones tracks so cached source animations remain reusable', () => {
    const track = new THREE.QuaternionKeyframeTrack(
      'hips.quaternion',
      [0, 1],
      quaternionValues(
        new THREE.Euler(0, 0, 0),
        new THREE.Euler(0, Math.PI, 0),
      ),
    );
    const original = Float32Array.from(track.values);
    const stabilized = stabilizeFacingTrack(track);

    expect(stabilized).not.toBe(track);
    expect(Array.from(track.values)).toEqual(Array.from(original));
    expect(Array.from(stabilized.values)).not.toEqual(Array.from(original));
  });
});
