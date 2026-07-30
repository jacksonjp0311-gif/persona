"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  FIRST_AMBIENT_DANCE_DELAY_MS,
  NEXT_AMBIENT_DANCE_DELAY_MS,
  ambientDanceCandidates,
  ambientDanceDelay,
  canPlayAmbientDance,
  chooseAmbientDance,
} = require("./ambient-dance.cjs");

function dance(id, assetUrls = [`${id}.vrma`]) {
  return {
    id,
    animation_name: id,
    animation_type: "DANCE",
    asset_urls: assetUrls,
  };
}

test("ambient dances use prompt first-run and relaxed repeat windows", () => {
  assert.equal(
    ambientDanceDelay(true, () => 0),
    FIRST_AMBIENT_DANCE_DELAY_MS.min,
  );
  assert.equal(
    ambientDanceDelay(true, () => 1),
    FIRST_AMBIENT_DANCE_DELAY_MS.max,
  );
  assert.equal(
    ambientDanceDelay(false, () => 0),
    NEXT_AMBIENT_DANCE_DELAY_MS.min,
  );
  assert.equal(
    ambientDanceDelay(false, () => 1),
    NEXT_AMBIENT_DANCE_DELAY_MS.max,
  );
});

test("ambient dances only start when the voice runtime is idle", () => {
  assert.equal(canPlayAmbientDance(null), true);
  assert.equal(
    canPlayAmbientDance({ activity: "idle", phase: "inactive" }),
    true,
  );
  assert.equal(
    canPlayAmbientDance({ activity: "idle", phase: "active" }),
    true,
  );
  assert.equal(
    canPlayAmbientDance({ activity: "listening", phase: "active" }),
    false,
  );
  assert.equal(
    canPlayAmbientDance({ activity: "speaking", phase: "active" }),
    false,
  );
});

test("ambient dances use captured clips without immediate repetition", () => {
  const candidates = ambientDanceCandidates([
    dance("first"),
    dance("procedural-only", []),
    { ...dance("talk"), animation_type: "TALK" },
    dance("second"),
  ]);
  assert.deepEqual(
    candidates.map(({ id }) => id),
    ["first", "second"],
  );
  assert.equal(chooseAmbientDance(candidates, "first", () => 0).id, "second");
});
