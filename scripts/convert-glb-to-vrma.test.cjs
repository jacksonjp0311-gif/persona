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
  const { retimeClip } = await import(scriptUrl.href);
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
});
