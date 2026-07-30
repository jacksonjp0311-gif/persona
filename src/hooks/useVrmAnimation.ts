import { useCallback, useEffect, useRef } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
  type VRMAnimation,
} from '@pixiv/three-vrm-animation';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import * as THREE from 'three';
import {
  randomAnimationUrl,
  type PlayableAnimationType,
} from '../animation-catalog';
import {
  configureAnimationAction,
  crossFadeAnimationActions,
  type AnimationPlayback,
} from '../animation-action';
import {
  PROCEDURAL_DURATIONS,
  isProceduralPreset,
  sampleProceduralPose,
  type ProceduralBone,
  type ProceduralPreset,
} from '../procedural-animation';

interface PlayOptions {
  animationUrls?: readonly string[];
  onComplete?: () => void;
  playback?: AnimationPlayback;
  proceduralPreset?: string | null;
}

interface PendingCompletion {
  action: THREE.AnimationAction;
  callback: () => void;
  generation: number;
}

function transitionSeconds(
  previous: PlayableAnimationType | null,
  next: PlayableAnimationType,
): number {
  if (previous === 'TALK' && next === 'IDLE') return 1.15;
  if (next === 'TALK') return 0.85;
  return 0.7;
}

export function useVrmAnimation(vrm: VRM | null) {
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const current = useRef<THREE.AnimationAction | null>(null);
  const currentType = useRef<PlayableAnimationType | null>(null);
  const cache = useRef(new Map<string, VRMAnimation>());
  const previousAnimation = useRef(
    new Map<PlayableAnimationType, string>(),
  );
  const requestGeneration = useRef(0);
  const pendingCompletion = useRef<PendingCompletion | null>(null);
  const procedural = useRef<{
    elapsed: number;
    onComplete?: () => void;
    playback: AnimationPlayback;
    preset: ProceduralPreset;
  } | null>(null);
  const proceduralBones = useRef(
    new Map<
      ProceduralBone,
      { base: THREE.Quaternion; node: THREE.Object3D }
    >(),
  );

  const restoreProceduralPose = useCallback(() => {
    for (const { base, node } of proceduralBones.current.values()) {
      node.quaternion.copy(base);
    }
    procedural.current = null;
  }, []);

  useEffect(() => {
    if (!vrm) return;
    const animationHistory = previousAnimation.current;
    const boundProceduralBones = proceduralBones.current;
    const animationMixer = new THREE.AnimationMixer(vrm.scene);
    boundProceduralBones.clear();
    const handleFinished = ({ action }: { action: THREE.AnimationAction }) => {
      const pending = pendingCompletion.current;
      if (
        pending?.action !== action ||
        pending.generation !== requestGeneration.current
      ) {
        return;
      }
      pendingCompletion.current = null;
      pending.callback();
    };
    animationMixer.addEventListener('finished', handleFinished);
    mixer.current = animationMixer;
    return () => {
      animationMixer.removeEventListener('finished', handleFinished);
      animationMixer.stopAllAction();
      mixer.current = null;
      current.current = null;
      currentType.current = null;
      pendingCompletion.current = null;
      for (const { base, node } of boundProceduralBones.values()) {
        node.quaternion.copy(base);
      }
      procedural.current = null;
      boundProceduralBones.clear();
      animationHistory.clear();
    };
  }, [vrm]);

  const load = useCallback(async (url: string) => {
    const cached = cache.current.get(url);
    if (cached) return cached;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
    const gltf = await loader.loadAsync(url);
    const animation = gltf.userData.vrmAnimations?.[0] as VRMAnimation | undefined;
    if (!animation) throw new Error(`No VRM animation found in ${url}`);
    cache.current.set(url, animation);
    return animation;
  }, []);

  const play = useCallback(
    async (
      type: PlayableAnimationType,
      {
        animationUrls = [],
        onComplete,
        playback = 'loop',
        proceduralPreset,
      }: PlayOptions = {},
    ) => {
      if (!vrm || !mixer.current) {
        if (playback === 'once') onComplete?.();
        return;
      }
      const generation = ++requestGeneration.current;
      pendingCompletion.current = null;
      try {
        const url = randomAnimationUrl(
          animationUrls,
          previousAnimation.current.get(type) ?? null,
        );
        if (!url) {
          if (isProceduralPreset(proceduralPreset)) {
            current.current?.fadeOut(
              transitionSeconds(currentType.current, type),
            );
            current.current = null;
            currentType.current = type;
            procedural.current = {
              elapsed: 0,
              onComplete,
              playback,
              preset: proceduralPreset,
            };
            return;
          }
          restoreProceduralPose();
          const fadeSeconds = transitionSeconds(currentType.current, type);
          current.current?.fadeOut(fadeSeconds);
          current.current = null;
          currentType.current = type;
          if (playback === 'once') onComplete?.();
          return;
        }
        restoreProceduralPose();
        previousAnimation.current.set(type, url);
        const animation = await load(url);
        if (generation !== requestGeneration.current || !mixer.current) return;
        const action = mixer.current.clipAction(createVRMAnimationClip(animation, vrm));
        const fadeSeconds = transitionSeconds(currentType.current, type);
        action.reset();
        configureAnimationAction(action, playback);
        if (playback === 'once') {
          if (onComplete) {
            pendingCompletion.current = {
              action,
              callback: onComplete,
              generation,
            };
          }
        }
        crossFadeAnimationActions(current.current, action, fadeSeconds);
        current.current = action;
        currentType.current = type;
      } catch (error) {
        console.warn('[persona] animation load failed', error);
        if (generation === requestGeneration.current && playback === 'once') {
          onComplete?.();
        }
      }
    },
    [load, restoreProceduralPose, vrm],
  );

  const update = useCallback(
    (delta: number) => {
      mixer.current?.update(delta);
      const active = procedural.current;
      if (!active || !vrm) return;

      active.elapsed += delta;
      const duration = PROCEDURAL_DURATIONS[active.preset];
      const sampleTime =
        active.playback === 'loop'
          ? active.elapsed % duration
          : Math.min(active.elapsed, duration);
      const pose = sampleProceduralPose(active.preset, sampleTime);
      for (const [bone, rotation] of Object.entries(pose) as [
        ProceduralBone,
        readonly [number, number, number],
      ][]) {
        let binding = proceduralBones.current.get(bone);
        if (!binding) {
          const node = vrm.humanoid?.getNormalizedBoneNode(
            bone as VRMHumanBoneName,
          );
          if (!node) continue;
          binding = { base: node.quaternion.clone(), node };
          proceduralBones.current.set(bone, binding);
        }
        const offset = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ'),
        );
        binding.node.quaternion.copy(binding.base).multiply(offset);
      }

      if (active.playback === 'once' && active.elapsed >= duration) {
        const callback = active.onComplete;
        restoreProceduralPose();
        callback?.();
      }
    },
    [restoreProceduralPose, vrm],
  );
  return { play, update };
}
