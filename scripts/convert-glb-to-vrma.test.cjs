"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const THREE = require("three");

test("retimeClip speeds authored animation without changing its key values", async () => {
  const scriptUrl = pathToFileURL(
    path.join(__dirname, "convert-glb-to-vrma.mjs"),
  );
  scriptUrl.searchParams.set("test", Date.now().toString());
  const {
    normalizeHipsPosition,
    retimeClip,
    trimAndRetimeClip,
  } = await import(scriptUrl.href);
  const track = new THREE.QuaternionKeyframeTrack(
    "hips.quaternion",
    [0, 1, 2],
    [0, 0, 0, 1, 0, 0, 0.2, 0.98, 0, 0, 0.4, 0.92],
  );
  const clip = new THREE.AnimationClip("move", 2, [track]);
  const faster = retimeClip(clip, 2);

  assert.equal(faster.duration, 1);
  assert.deepEqual([...faster.tracks[0].times], [0, 0.5, 1]);
  assert.deepEqual(
    [...faster.tracks[0].values],
    [...clip.tracks[0].values],
  );

  const trimmed = trimAndRetimeClip(clip, {
    start: 0.5,
    end: 1.5,
    speed: 2,
  });
  assert.equal(trimmed.duration, 0.5);
  assert.deepEqual([...trimmed.tracks[0].times], [0, 0.25, 0.5]);

  const hipsTrack = new THREE.VectorKeyframeTrack(
    "hips.position",
    [0, 1],
    [2, 0.8, -3, 2.7, 1.3, -2.4],
  );
  const hipsClip = new THREE.AnimationClip("hips", 1, [hipsTrack]);
  normalizeHipsPosition(hipsClip, "hips");
  assert.deepEqual(
    [...hipsTrack.values].map((value) => Number(value.toFixed(2))),
    [0, 0, 0, 0.35, 0, 0.35],
  );
});
