import * as THREE from "three";

const DEFAULT_FPS = 60;
export const MOTION_CLEANUP_PROFILES = Object.freeze({
  responsive: { fps: 60, smoothingScale: 0.72 },
  natural: { fps: 60, smoothingScale: 1 },
  tight: { fps: 60, smoothingScale: 1.35 },
});

function sampleTimes(duration, fps) {
  const frameCount = Math.max(2, Math.floor(duration * fps) + 1);
  const times = new Float32Array(frameCount);
  for (let index = 0; index < frameCount; index += 1) {
    times[index] = Math.min(duration, index / fps);
  }
  times[frameCount - 1] = duration;
  return times;
}

function resampleValues(track, times, valueSize) {
  const interpolant = track.createInterpolant();
  const values = new Float32Array(times.length * valueSize);
  for (let frame = 0; frame < times.length; frame += 1) {
    values.set(interpolant.evaluate(times[frame]), frame * valueSize);
  }
  return values;
}

function gaussianWeight(distanceSeconds, sigmaSeconds) {
  const normalized = distanceSeconds / sigmaSeconds;
  return Math.exp(-0.5 * normalized * normalized);
}

export function smoothQuaternionValues(
  values,
  times,
  sigmaSeconds = 0.035,
) {
  const output = new Float32Array(values.length);
  const radiusSeconds = sigmaSeconds * 3;
  const reference = new THREE.Quaternion();
  const candidate = new THREE.Quaternion();

  for (let frame = 0; frame < times.length; frame += 1) {
    reference.fromArray(values, frame * 4).normalize();
    let x = 0;
    let y = 0;
    let z = 0;
    let w = 0;
    let weightSum = 0;

    for (let sample = frame; sample >= 0; sample -= 1) {
      const distance = times[frame] - times[sample];
      if (distance > radiusSeconds) break;
      candidate.fromArray(values, sample * 4).normalize();
      const sign = reference.dot(candidate) < 0 ? -1 : 1;
      const weight = gaussianWeight(distance, sigmaSeconds);
      x += candidate.x * sign * weight;
      y += candidate.y * sign * weight;
      z += candidate.z * sign * weight;
      w += candidate.w * sign * weight;
      weightSum += weight;
    }
    for (let sample = frame + 1; sample < times.length; sample += 1) {
      const distance = times[sample] - times[frame];
      if (distance > radiusSeconds) break;
      candidate.fromArray(values, sample * 4).normalize();
      const sign = reference.dot(candidate) < 0 ? -1 : 1;
      const weight = gaussianWeight(distance, sigmaSeconds);
      x += candidate.x * sign * weight;
      y += candidate.y * sign * weight;
      z += candidate.z * sign * weight;
      w += candidate.w * sign * weight;
      weightSum += weight;
    }

    const length = Math.hypot(x, y, z, w) || weightSum || 1;
    output[frame * 4] = x / length;
    output[frame * 4 + 1] = y / length;
    output[frame * 4 + 2] = z / length;
    output[frame * 4 + 3] = w / length;
  }
  return output;
}

export function smoothVectorValues(
  values,
  times,
  sigmaSeconds = 0.045,
) {
  const output = new Float32Array(values.length);
  const radiusSeconds = sigmaSeconds * 3;

  for (let frame = 0; frame < times.length; frame += 1) {
    let x = 0;
    let y = 0;
    let z = 0;
    let weightSum = 0;
    for (let sample = 0; sample < times.length; sample += 1) {
      const distance = Math.abs(times[sample] - times[frame]);
      if (distance > radiusSeconds) continue;
      const weight = gaussianWeight(distance, sigmaSeconds);
      x += values[sample * 3] * weight;
      y += values[sample * 3 + 1] * weight;
      z += values[sample * 3 + 2] * weight;
      weightSum += weight;
    }
    output[frame * 3] = x / weightSum;
    output[frame * 3 + 1] = y / weightSum;
    output[frame * 3 + 2] = z / weightSum;
  }
  return output;
}

function smoothingForTrack(name) {
  if (/Head|Neck|Spine/i.test(name)) return 0.045;
  if (/Hand|ForeArm|Foot|Leg/i.test(name)) return 0.032;
  return 0.038;
}

export function cleanMotionClip(
  clip,
  { fps = DEFAULT_FPS, smoothingScale = 1 } = {},
) {
  const duration = clip.duration;
  const times = sampleTimes(duration, fps);
  const tracks = clip.tracks.map((track) => {
    if (track.ValueTypeName === "quaternion") {
      const values = resampleValues(track, times, 4);
      return new THREE.QuaternionKeyframeTrack(
        track.name,
        times,
        smoothQuaternionValues(
          values,
          times,
          smoothingForTrack(track.name) * smoothingScale,
        ),
      );
    }
    if (track.ValueTypeName === "vector") {
      const values = resampleValues(track, times, 3);
      return new THREE.VectorKeyframeTrack(
        track.name,
        times,
        smoothVectorValues(values, times, 0.045 * smoothingScale),
      );
    }
    return track.clone();
  });
  return new THREE.AnimationClip(clip.name, duration, tracks);
}

export function motionJerkMetrics(clip) {
  const angularJerks = [];
  for (const track of clip.tracks.filter(
    (candidate) => candidate.ValueTypeName === "quaternion",
  )) {
    let previousVelocity = 0;
    for (let frame = 1; frame < track.times.length; frame += 1) {
      const before = new THREE.Quaternion()
        .fromArray(track.values, (frame - 1) * 4)
        .normalize();
      const after = new THREE.Quaternion()
        .fromArray(track.values, frame * 4)
        .normalize();
      const delta = Math.max(
        1e-6,
        track.times[frame] - track.times[frame - 1],
      );
      const velocity =
        (2 * Math.acos(Math.min(1, Math.abs(before.dot(after))))) / delta;
      if (frame > 1) {
        angularJerks.push(Math.abs(velocity - previousVelocity) / delta);
      }
      previousVelocity = velocity;
    }
  }
  angularJerks.sort((left, right) => left - right);
  const percentile95 =
    angularJerks[Math.floor((angularJerks.length - 1) * 0.95)] ?? 0;
  return {
    angularJerkP95: percentile95,
    fps:
      clip.tracks[0]?.times.length > 1
        ? 1 / (clip.tracks[0].times[1] - clip.tracks[0].times[0])
        : 0,
  };
}
