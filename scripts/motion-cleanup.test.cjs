"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("motion cleanup lowers quaternion jerk and resamples to 60 fps", async () => {
  const THREE = await import("three");
  const { cleanMotionClip, motionJerkMetrics } = await import(
    "./motion-cleanup.mjs"
  );
  const times = new Float32Array([0, 0.01, 0.02, 0.03, 0.04]);
  const values = new Float32Array([
    0, 0, 0, 1,
    0, 0.05, 0, 0.9987,
    0, -0.08, 0, 0.9968,
    0, 0.12, 0, 0.9928,
    0, 0.14, 0, 0.9902,
  ]);
  const clip = new THREE.AnimationClip("noisy", 0.04, [
    new THREE.QuaternionKeyframeTrack("Head.quaternion", times, values),
  ]);

  const before = motionJerkMetrics(clip);
  const cleaned = cleanMotionClip(clip);
  const after = motionJerkMetrics(cleaned);

  assert.ok(after.angularJerkP95 < before.angularJerkP95);
  assert.ok(Math.abs(after.fps - 60) < 0.01);
  assert.ok(
    cleaned.tracks[0].values.every((value) => Number.isFinite(value)),
  );
});

test("quaternion smoothing keeps outputs normalized", async () => {
  const { smoothQuaternionValues } = await import("./motion-cleanup.mjs");
  const times = new Float32Array([0, 1 / 60, 2 / 60]);
  const output = smoothQuaternionValues(
    new Float32Array([
      0, 0, 0, 1,
      0, 0.2, 0, 0.9799,
      0, 0.4, 0, 0.9165,
    ]),
    times,
  );

  for (let frame = 0; frame < times.length; frame += 1) {
    const offset = frame * 4;
    const length = Math.hypot(
      output[offset],
      output[offset + 1],
      output[offset + 2],
      output[offset + 3],
    );
    assert.ok(Math.abs(length - 1) < 1e-5);
  }
});
