import type {
  AnimationType,
  PlayableAnimationType,
} from './animation-catalog';

export interface BodyAnimationOverride {
  animation: PlayableAnimationType;
  animationName?: string;
  animationUrls?: string[];
  mirror?: boolean;
  proceduralPreset?: string | null;
  requestId: number;
  source?: 'ambient' | 'command';
}

export function resolveBodyAnimation(
  voiceAnimation: AnimationType,
  override: BodyAnimationOverride | null,
): PlayableAnimationType {
  return override?.animation ?? voiceAnimation;
}

export function finishBodyAnimationOverride(
  override: BodyAnimationOverride | null,
  requestId: number,
): BodyAnimationOverride | null {
  return override?.requestId === requestId ? null : override;
}
