import * as THREE from 'three';

export type AnimationPlayback = 'loop' | 'once';

export function configureAnimationAction(
  action: THREE.AnimationAction,
  playback: AnimationPlayback,
  timeScale = 1,
): THREE.AnimationAction {
  action.setEffectiveTimeScale(timeScale);
  if (playback === 'once') {
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
  } else {
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
  }
  return action;
}

export function crossFadeAnimationActions(
  previous: THREE.AnimationAction | null,
  next: THREE.AnimationAction,
  duration: number,
): void {
  if (!previous) {
    next.setEffectiveWeight(1).play();
    return;
  }
  previous.fadeOut(duration);
  next.setEffectiveWeight(1).fadeIn(duration).play();
}
