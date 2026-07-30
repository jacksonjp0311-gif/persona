import type { Vector3Tuple } from 'three';
import { MAX_CREW_SIZE } from './crew-roster';

export interface CrewLayoutSlot {
  position: Vector3Tuple;
  scale: number;
}

const HORIZONTAL_POSITIONS: Readonly<Record<number, readonly number[]>> = {
  1: [0],
  2: [-0.46, 0.46],
  3: [0, -0.9, 0.9],
  4: [-0.45, 0.45, -1.35, 1.35],
};

/**
 * Places the leader near the visual center, then alternates members outward.
 * A shallow negative-Z arc leaves room for wide arm movement without turning
 * any character away from the camera.
 */
export function createCrewLayout(count: number): CrewLayoutSlot[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_CREW_SIZE) {
    throw new RangeError(
      `Crew size must be an integer between 1 and ${MAX_CREW_SIZE}.`,
    );
  }
  return HORIZONTAL_POSITIONS[count].map((x) => ({
    position: [x, 0, -Math.abs(x) * 0.075],
    scale: 1,
  }));
}
