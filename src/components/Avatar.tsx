import { Suspense, useEffect, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useVrmLoader } from '../hooks/useVrmLoader';
import { useVrmAnimation } from '../hooks/useVrmAnimation';
import { useAmplitudeLipSync } from '../hooks/useAmplitudeLipSync';
import { useBlink } from '../hooks/useBlink';
import type { PlayableAnimationType } from '../animation-catalog';
import type { HumanoidFramingLandmarks } from '../camera-framing';
import type { Vector3Tuple } from 'three';

interface AvatarProps {
  animation: PlayableAnimationType;
  animationRequest: number;
  animationUrls?: readonly string[];
  audioLevel: number;
  characterId: string;
  mirror?: boolean;
  modelUrl: string;
  onAnimationComplete: (characterId: string) => void;
  playback: 'loop' | 'once';
  position?: Vector3Tuple;
  proceduralPreset?: string | null;
  scale?: number;
  speaking: boolean;
  onReady?: (
    characterId: string,
    scene: THREE.Object3D,
    landmarks: HumanoidFramingLandmarks | null,
  ) => void;
}

function AvatarModel({
  animation,
  animationRequest,
  animationUrls,
  audioLevel,
  characterId,
  mirror,
  modelUrl,
  onAnimationComplete,
  playback,
  position,
  proceduralPreset,
  scale = 1,
  speaking,
  onReady,
}: AvatarProps) {
  const vrm = useVrmLoader(modelUrl);
  const { play, update: updateAnimation } = useVrmAnimation(vrm);
  const updateLipSync = useAmplitudeLipSync(vrm);
  const updateBlink = useBlink(vrm);

  useEffect(() => {
    void play(animation, {
      animationUrls,
      onComplete: () => onAnimationComplete(characterId),
      playback,
      proceduralPreset,
    });
  }, [
    animation,
    animationRequest,
    animationUrls,
    characterId,
    onAnimationComplete,
    play,
    playback,
    proceduralPreset,
  ]);

  useLayoutEffect(() => {
    if (!vrm) return;
    vrm.scene.updateWorldMatrix(true, true);
    const head = vrm.humanoid
      ?.getNormalizedBoneNode('head')
      ?.getWorldPosition(new THREE.Vector3());
    const feet = [
      vrm.humanoid?.getNormalizedBoneNode('leftFoot'),
      vrm.humanoid?.getNormalizedBoneNode('rightFoot'),
    ]
      .filter((bone): bone is THREE.Object3D => bone != null)
      .map((bone) => bone.getWorldPosition(new THREE.Vector3()));
    const footCenter =
      feet.length > 0
        ? feet
            .reduce(
              (center, foot) => center.add(foot),
              new THREE.Vector3(),
            )
            .multiplyScalar(1 / feet.length)
        : null;
    onReady?.(
      characterId,
      vrm.scene,
      head && footCenter ? { feet: footCenter, head } : null,
    );
  }, [characterId, onReady, vrm]);

  useFrame((_, delta) => {
    if (!vrm) return;
    updateAnimation(delta);
    updateBlink(delta);
    updateLipSync(delta, audioLevel, speaking);
    vrm.update(delta);
  });

  return vrm ? (
    <group position={position} scale={scale}>
      <group scale={[mirror ? -1 : 1, 1, 1]}>
        <primitive object={vrm.scene} />
      </group>
    </group>
  ) : null;
}

export function Avatar(props: AvatarProps) {
  return (
    <Suspense fallback={null}>
      <AvatarModel {...props} />
    </Suspense>
  );
}
