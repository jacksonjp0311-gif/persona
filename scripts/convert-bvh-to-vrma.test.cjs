"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const THREE = require("three");

test("trimAndRetimeClip removes bind-pose lead-ins and speeds the result", async () => {
  const scriptUrl = pathToFileURL(
    path.join(__dirname, "convert-bvh-to-vrma.mjs"),
  );
  scriptUrl.searchParams.set("test", Date.now().toString());
  const { trimAndRetimeClip } = await import(scriptUrl.href);
  const track = new THREE.VectorKeyframeTrack(
    "Hips.position",
    [0, 1, 2, 3],
    [0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0],
  );
  const clip = new THREE.AnimationClip("capture", 3, [track]);
  const selected = trimAndRetimeClip(clip, {
    start: 1,
    end: 3,
    speed: 2,
  });

  assert.equal(selected.duration, 1);
  assert.deepEqual([...selected.tracks[0].times], [0, 0.5, 1]);
  assert.deepEqual(
    [...selected.tracks[0].values],
    [1, 0, 0, 2, 0, 0, 3, 0, 0],
  );
});
