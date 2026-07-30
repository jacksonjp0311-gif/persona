import * as THREE from 'three';

export interface FullBodyFraming {
  position: THREE.Vector3;
  target: THREE.Vector3;
  distance: number;
}

export interface HumanoidFramingLandmarks {
  feet: THREE.Vector3;
  head: THREE.Vector3;
}

export function humanoidFramingBox(
  sceneBox: THREE.Box3,
  { feet, head }: HumanoidFramingLandmarks,
): THREE.Box3 {
  const bodyHeight = head.y - feet.y;
  if (!Number.isFinite(bodyHeight) || bodyHeight <= 0.1) {
    return sceneBox.clone();
  }
  const box = sceneBox.clone();
  const safeBottom = feet.y - bodyHeight * 0.08;
  const safeTop = head.y + bodyHeight * 0.45;
  box.min.y = Math.max(sceneBox.min.y, safeBottom);
  box.max.y = Math.min(sceneBox.max.y, safeTop);
  if (box.max.y - box.min.y < bodyHeight) {
    return sceneBox.clone();
  }
  return box;
}

export function calculateFullBodyFraming(
  box: THREE.Box3,
  verticalFovDegrees: number,
  aspect: number,
  margin = 1.12,
  zoom = 1,
  targetHeightRatio = 0.5,
): FullBodyFraming {
  const size = box.getSize(new THREE.Vector3());
  const target = box.getCenter(new THREE.Vector3());
  target.y =
    box.min.y +
    size.y * THREE.MathUtils.clamp(targetHeightRatio, 0, 1);
  const halfVerticalFov = THREE.MathUtils.degToRad(verticalFovDegrees) / 2;
  const halfHorizontalFov = Math.atan(Math.tan(halfVerticalFov) * aspect);
  const depthPadding = size.z / 2;
  const heightDistance = size.y / 2 / Math.tan(halfVerticalFov);
  const widthDistance = size.x / 2 / Math.tan(halfHorizontalFov);
  const distance =
    Math.max(heightDistance, widthDistance) * margin / zoom + depthPadding;

  return {
    position: target.clone().add(new THREE.Vector3(0, 0, distance)),
    target,
    distance,
  };
}
