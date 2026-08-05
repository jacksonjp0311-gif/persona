"use strict";

/** Start dancing almost immediately after deploy / resume. */
const FIRST_AMBIENT_DANCE_DELAY_MS = {
  min: 120,
  max: 500,
};
/**
 * While a dance is already looping, rotate to another style on this window.
 * Gaps between styles are zero because ambient dances loop continuously.
 */
const NEXT_AMBIENT_DANCE_DELAY_MS = {
  min: 14_000,
  max: 24_000,
};

function ambientDanceDelay(firstDance, random = Math.random) {
  const range = firstDance
    ? FIRST_AMBIENT_DANCE_DELAY_MS
    : NEXT_AMBIENT_DANCE_DELAY_MS;
  const unit = Math.min(1, Math.max(0, random()));
  return Math.round(range.min + unit * (range.max - range.min));
}

/**
 * Keep ambient motion going unless the character is actively speaking.
 * Listening / idle / inactive should all dance so the desktop avatar never
 * freezes while Codex is attached but quiet.
 */
function canPlayAmbientDance(voiceState) {
  if (voiceState == null) return true;
  if (voiceState.activity === "speaking") return false;
  return (
    voiceState.phase === "inactive" ||
    voiceState.phase === "starting" ||
    voiceState.phase === "active" ||
    voiceState.phase === "stopping"
  );
}

/**
 * Only proven smooth procedural dances ambient-loop on the desktop avatar.
 * Matches the hover-wheel featured set so autoplay never picks a broken move.
 */
const RELIABLE_AMBIENT_PRESETS = new Set([
  "freestyle-groove",
  "hip-hop-bounce",
  "justice-bounce",
  "floss-swing",
  "running-man",
  "robot-pop",
  "two-step",
  "say-so-bounce",
]);

function ambientDanceCandidates(animations) {
  return animations.filter(
    (animation) =>
      animation.animation_type === "DANCE" &&
      typeof animation.procedural_preset === "string" &&
      RELIABLE_AMBIENT_PRESETS.has(animation.procedural_preset),
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
