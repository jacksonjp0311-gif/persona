"use strict";

const FIRST_AMBIENT_DANCE_DELAY_MS = {
  min: 8_000,
  max: 16_000,
};
const NEXT_AMBIENT_DANCE_DELAY_MS = {
  min: 24_000,
  max: 50_000,
};

function ambientDanceDelay(firstDance, random = Math.random) {
  const range = firstDance
    ? FIRST_AMBIENT_DANCE_DELAY_MS
    : NEXT_AMBIENT_DANCE_DELAY_MS;
  const unit = Math.min(1, Math.max(0, random()));
  return Math.round(range.min + unit * (range.max - range.min));
}

function canPlayAmbientDance(voiceState) {
  return (
    voiceState == null ||
    voiceState.phase === "inactive" ||
    (voiceState.phase === "active" && voiceState.activity === "idle")
  );
}

function ambientDanceCandidates(animations) {
  return animations.filter(
    (animation) =>
      animation.animation_type === "DANCE" &&
      animation.asset_urls.length > 0,
  );
}

function chooseAmbientDance(animations, previousId, random = Math.random) {
  if (animations.length === 0) return null;
  const choices =
    animations.length > 1
      ? animations.filter((animation) => animation.id !== previousId)
      : [...animations];
  const unit = Math.min(0.999999, Math.max(0, random()));
  return choices[Math.floor(unit * choices.length)] ?? null;
}

module.exports = {
  FIRST_AMBIENT_DANCE_DELAY_MS,
  NEXT_AMBIENT_DANCE_DELAY_MS,
  ambientDanceCandidates,
  ambientDanceDelay,
  canPlayAmbientDance,
  chooseAmbientDance,
};
