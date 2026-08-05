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
  MAX_FRONT_FACING_YAW,
  stabilizeFacingTrack,
} from '../front-facing-motion';
import {
  PROCEDURAL_DURATIONS,
  RELAXED_REST_POSE,
  frontFacingProceduralPose,
  isProceduralPreset,
  proceduralBlendWeight,
  sampleProceduralPose,
  sampleProceduralRoot,
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

const EMPTY_URLS: readonly string[] = [];

export function transitionSeconds(
  previous: PlayableAnimationType | null,
  next: PlayableAnimationType,
): number {
  if (previous === 'TALK' && next === 'IDLE') return 0.32;
  if (next === 'TALK') return 0.28;
  return 0.2;
}

export function playbackRate(
  type: PlayableAnimationType,
  playback: AnimationPlayback,
): number {
  if (type === 'IDLE') return 0.96;
  if (type === 'TALK') return 1.08;
  // Keep dances at natural tempo — faster rates looked jittery on procedural.
  if (type === 'DANCE') return playback === 'once' ? 1.05 : 1.0;
  return playback === 'once' ? 1.25 : 1.12;
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
    completed: boolean;
  } | null>(null);
  const proceduralBones = useRef(
    new Map<
      ProceduralBone,
      { base: THREE.Quaternion; node: THREE.Object3D }
    >(),
  );
  const proceduralRoot = useRef<{
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
  } | null>(null);

  const restoreProceduralPose = useCallback(() => {
    for (const { base, node } of proceduralBones.current.values()) {
      node.quaternion.copy(base);
    }
    if (proceduralRoot.current && vrm) {
      vrm.scene.position.copy(proceduralRoot.current.position);
      vrm.scene.quaternion.copy(proceduralRoot.current.quaternion);
    }
    procedural.current = null;
  }, [vrm]);

  const hardStopClips = useCallback(() => {
    if (mixer.current) {
      mixer.current.stopAllAction();
    }
    current.current = null;
    pendingCompletion.current = null;
  }, []);

  const activateProcedural = useCallback(
    (
      type: PlayableAnimationType,
      preset: ProceduralPreset,
      playback: AnimationPlayback,
      onComplete?: () => void,
    ) => {
      // Clip actions must fully stop — otherwise they overwrite dance bones.
      hardStopClips();
      restoreProceduralPose();
      // Rebind bases from a clean rest pose for the new preset.
      proceduralBones.current.clear();
      currentType.current = type;
      procedural.current = {
        completed: false,
        elapsed: 0,
        onComplete,
        // Dances must loop or the body freezes after one cycle.
        playback: type === 'DANCE' ? 'loop' : playback,
        preset,
      };
    },
    [hardStopClips, restoreProceduralPose],
  );

  useEffect(() => {
    if (!vrm) return;
    const animationHistory = previousAnimation.current;
    const boundProceduralBones = proceduralBones.current;
    const boundProceduralRoot = {
      position: vrm.scene.position.clone(),
      quaternion: vrm.scene.quaternion.clone(),
    };
    proceduralRoot.current = boundProceduralRoot;
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
      vrm.scene.position.copy(boundProceduralRoot.position);
      vrm.scene.quaternion.copy(boundProceduralRoot.quaternion);
      procedural.current = null;
      proceduralRoot.current = null;
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
    const animation = gltf.userData.vrmAnimations?.[0] as
      | VRMAnimation
      | undefined;
    if (!animation) throw new Error(`No VRM animation found in ${url}`);
    cache.current.set(url, animation);
    return animation;
  }, []);

  const play = useCallback(
    async (
      type: PlayableAnimationType,
      {
        animationUrls = EMPTY_URLS,
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
        // Dances always prefer procedural motion — VRMA clips are unreliable.
        // Fall back to freestyle if a bad/missing preset slips through.
        const dancePreset =
          type === 'DANCE'
            ? isProceduralPreset(proceduralPreset)
              ? proceduralPreset
              : ('freestyle-groove' as const)
            : null;
        if (dancePreset) {
          activateProcedural(type, dancePreset, playback, onComplete);
          return;
        }
        if (type !== 'DANCE' && isProceduralPreset(proceduralPreset) && animationUrls.length === 0) {
          activateProcedural(type, proceduralPreset, playback, onComplete);
          return;
        }
        const url = randomAnimationUrl(
          animationUrls,
          previousAnimation.current.get(type) ?? null,
        );
        if (!url) {
          if (isProceduralPreset(proceduralPreset)) {
            activateProcedural(
              type,
              proceduralPreset,
              playback,
              onComplete,
            );
            return;
          }
          // Last resort: keep the body alive with freestyle rather than freezing.
          if (type === 'DANCE' || type === 'IDLE') {
            activateProcedural(
              type === 'DANCE' ? 'DANCE' : type,
              type === 'IDLE' ? 'breathing-idle' : 'freestyle-groove',
              playback === 'once' ? 'loop' : playback,
              onComplete,
            );
            return;
          }
          hardStopClips();
          currentType.current = type;
          if (playback === 'once') onComplete?.();
          return;
        }
        previousAnimation.current.set(type, url);
        // Leaving procedural mode — restore rest before clip playback.
        restoreProceduralPose();
        const animation = await load(url);
        if (generation !== requestGeneration.current || !mixer.current) return;
        const previousAction = current.current;
        // Clamp hips + torso heading so captured dances stay camera-facing.
        for (const bone of [
          'hips',
          'spine',
          'chest',
          'upperChest',
        ] as const) {
          const track = animation.humanoidTracks.rotation.get(bone);
          if (!track) continue;
          animation.humanoidTracks.rotation.set(
            bone,
            stabilizeFacingTrack(
              track,
              bone === 'hips' ? undefined : MAX_FRONT_FACING_YAW * 0.55,
            ),
          );
        }
        const action = mixer.current.clipAction(
          createVRMAnimationClip(animation, vrm),
        );
        const fadeSeconds = transitionSeconds(currentType.current, type);
        action.reset();
        configureAnimationAction(
          action,
          playback,
          playbackRate(type, playback),
        );
        if (playback === 'once') {
          if (onComplete) {
            pendingCompletion.current = {
              action,
              callback: onComplete,
              generation,
            };
          }
        }
        crossFadeAnimationActions(previousAction, action, fadeSeconds);
        mixer.current.update(0);
        current.current = action;
        currentType.current = type;
      } catch (error) {
        console.warn('[persona] animation load failed', error);
        if (generation !== requestGeneration.current) return;
        if (isProceduralPreset(proceduralPreset)) {
          activateProcedural(
            type,
            proceduralPreset,
            playback,
            onComplete,
          );
        } else if (playback === 'once') {
          onComplete?.();
        }
      }
    },
    [activateProcedural, hardStopClips, load, restoreProceduralPose, vrm],
  );

  const update = useCallback(
    (delta: number) => {
      const active = procedural.current;
      // While procedural dance/idle owns the body, skip mixer writes.
      if (!active) {
        mixer.current?.update(delta);
        return;
      }
      if (!vrm) return;

      active.elapsed += delta;
      const duration = PROCEDURAL_DURATIONS[active.preset];
      const sampleTime =
        active.playback === 'loop'
          ? active.elapsed % duration
          : Math.min(active.elapsed, duration);
      // Dances already include a full relaxed baseline; don't double-merge rest.
      const sampled = sampleProceduralPose(active.preset, sampleTime);
      const pose = frontFacingProceduralPose(
        active.preset === 'breathing-idle' ||
          active.preset === 'conversational-talk' ||
          active.preset === 'calm-listen'
          ? { ...RELAXED_REST_POSE, ...sampled }
          : { ...RELAXED_REST_POSE, ...sampled },
      );
      const weight = proceduralBlendWeight(
        active.elapsed,
        duration,
        active.playback,
      );
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
        // Apply as local euler offset from the VRM rest (base) pose.
        const offset = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ'),
        );
        const target = binding.base.clone().multiply(offset);
        binding.node.quaternion.slerpQuaternions(
          binding.base,
          target,
          weight,
        );
      }
      const rootBinding = proceduralRoot.current;
      if (rootBinding) {
        const rootMotion = sampleProceduralRoot(active.preset, sampleTime);
        // Tiny bounce only — never walk off-frame or yaw away from camera.
        vrm.scene.position.set(
          rootBinding.position.x,
          rootBinding.position.y + rootMotion.position[1] * weight,
          rootBinding.position.z,
        );
        vrm.scene.quaternion.copy(rootBinding.quaternion);
      }

      if (
        active.playback === 'once' &&
        active.elapsed >= duration &&
        !active.completed
      ) {
        active.completed = true;
        active.onComplete?.();
      }
    },
    [vrm],
  );
  return { play, update };
}
