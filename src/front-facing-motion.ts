import * as THREE from 'three';

export const MAX_FRONT_FACING_YAW = THREE.MathUtils.degToRad(34);

function wrappedAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function twistAroundY(
  quaternion: THREE.Quaternion,
  target = new THREE.Quaternion(),
): THREE.Quaternion {
  const length = Math.hypot(quaternion.y, quaternion.w);
  if (length < 1e-7) return target.identity();
  return target.set(0, quaternion.y / length, 0, quaternion.w / length);
}

export function facingYaw(quaternion: THREE.Quaternion): number {
  const twist = twistAroundY(quaternion);
  return wrappedAngle(2 * Math.atan2(twist.y, twist.w));
}

/**
 * Keeps captured motion camera-facing without flattening the dancer's natural
 * hip sway. Large root turns are clamped while pitch, roll, and small yaw
 * accents remain intact.
 */
export function stabilizeFacingValues(
  source: ArrayLike<number>,
  maxYaw = MAX_FRONT_FACING_YAW,
): Float32Array {
  if (source.length < 4 || source.length % 4 !== 0) {
    return Float32Array.from(source);
  }

  const output = new Float32Array(source.length);
  const current = new THREE.Quaternion();
  const currentTwist = new THREE.Quaternion();
  const swing = new THREE.Quaternion();
  const limitedTwist = new THREE.Quaternion();
  const stabilized = new THREE.Quaternion();
  const previous = new THREE.Quaternion();

  current.fromArray(source, 0).normalize();
  const initialYaw = facingYaw(current);

  for (let offset = 0; offset < source.length; offset += 4) {
    current.fromArray(source, offset).normalize();
    twistAroundY(current, currentTwist);
    swing.copy(current).multiply(currentTwist.clone().invert());

    const relativeYaw = wrappedAngle(facingYaw(current) - initialYaw);
    const limitedYaw =
      initialYaw + THREE.MathUtils.clamp(relativeYaw, -maxYaw, maxYaw);
    limitedTwist.setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      limitedYaw,
    );
    stabilized.copy(swing).multiply(limitedTwist).normalize();

    if (offset > 0 && previous.dot(stabilized) < 0) {
      stabilized.set(
        -stabilized.x,
        -stabilized.y,
        -stabilized.z,
        -stabilized.w,
      );
    }
    stabilized.toArray(output, offset);
    previous.copy(stabilized);
  }

  return output;
}

export function stabilizeFacingTrack(
  track: THREE.QuaternionKeyframeTrack,
  maxYaw = MAX_FRONT_FACING_YAW,
): THREE.QuaternionKeyframeTrack {
  const stabilized = track.clone();
  stabilized.values = stabilizeFacingValues(track.values, maxYaw);
  return stabilized;
}
