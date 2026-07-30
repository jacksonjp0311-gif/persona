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

function dance(id, assetUrls = [`${id}.vrma`], proceduralPreset = null) {
  return {
    id,
    animation_name: id,
    animation_type: "DANCE",
    asset_urls: assetUrls,
    procedural_preset: proceduralPreset,
  };
}

test("ambient dances start immediately and rotate while looping", () => {
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
  assert.ok(FIRST_AMBIENT_DANCE_DELAY_MS.max < 1_000);
  assert.ok(NEXT_AMBIENT_DANCE_DELAY_MS.min >= 5_000);
});

test("ambient dances run while idle or listening, not while speaking", () => {
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
    true,
  );
  assert.equal(
    canPlayAmbientDance({ activity: "speaking", phase: "active" }),
    false,
  );
});

test("ambient dances use captured clips and procedural dances", () => {
  const candidates = ambientDanceCandidates([
    dance("first"),
    dance("procedural-only", [], "freestyle-groove"),
    { ...dance("talk"), animation_type: "TALK" },
    dance("second"),
    dance("empty", [], null),
  ]);
  assert.deepEqual(
    candidates.map(({ id }) => id),
    ["first", "procedural-only", "second"],
  );
  assert.equal(chooseAmbientDance(candidates, "first", () => 0).id, "procedural-only");
});
