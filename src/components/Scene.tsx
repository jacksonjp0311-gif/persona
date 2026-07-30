import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useThree } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  OrbitControls,
} from '@react-three/drei';
import dawnEnvironment from '@pmndrs/assets/hdri/dawn.exr';
import * as THREE from 'three';
import { Avatar } from './Avatar';
import type { PlayableAnimationType } from '../animation-catalog';
import {
  calculateFullBodyFraming,
  humanoidFramingBox,
  type HumanoidFramingLandmarks,
} from '../camera-framing';

interface SceneProps {
  animation: PlayableAnimationType;
  animationRequest: number;
  animationUrls?: readonly string[];
  audioLevel: number;
  characterSize: number;
  enablePan?: boolean;
  framingMargin?: number;
  groundShadow?: boolean;
  mirror?: boolean;
  modelUrl: string;
  onAnimationComplete: () => void;
  playback: 'loop' | 'once';
  proceduralPreset?: string | null;
  speaking: boolean;
}

interface TargetControls {
  target: THREE.Vector3;
  update: () => void;
}

interface Grounding {
  far: number;
  position: [number, number, number];
  scale: number;
}

function supportsTarget(controls: unknown): controls is TargetControls {
  if (!controls || typeof controls !== 'object') return false;
  const candidate = controls as Partial<TargetControls>;
  return candidate.target instanceof THREE.Vector3 &&
    typeof candidate.update === 'function';
}

function FullBodyCamera({
  characterSize,
  framingMargin,
  object,
  framingBox,
}: {
  characterSize: number;
  framingBox: THREE.Box3 | null;
  framingMargin: number;
  object: THREE.Object3D | null;
}) {
  const getThreeState = useThree((state) => state.get);
  const controlsReady = useThree((state) => Boolean(state.controls));
  const framedObject = useRef<THREE.Object3D | null>(null);
  const framedBox = useRef<THREE.Box3 | null>(null);
  const framedCharacterSize = useRef<number | null>(null);
  const framedMargin = useRef<number | null>(null);

  useLayoutEffect(() => {
    const { camera, controls } = getThreeState();
    if (
      !object ||
      (framedObject.current === object &&
        framedBox.current === framingBox &&
        framedCharacterSize.current === characterSize &&
        framedMargin.current === framingMargin) ||
      !(camera instanceof THREE.PerspectiveCamera) ||
      !supportsTarget(controls)
    ) {
      return;
    }

    object.updateWorldMatrix(true, true);
    const box = framingBox ?? new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;

    const framing = calculateFullBodyFraming(
      box,
      camera.fov,
      camera.aspect,
      framingMargin,
      characterSize,
      0.18,
    );
    camera.position.copy(framing.position);
    camera.near = Math.max(0.01, framing.distance / 100);
    camera.far = Math.max(100, framing.distance * 100);
    camera.lookAt(framing.target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    controls.target.copy(framing.target);
    controls.update();
    framedObject.current = object;
    framedBox.current = framingBox;
    framedCharacterSize.current = characterSize;
    framedMargin.current = framingMargin;
  }, [
    characterSize,
    controlsReady,
    framingMargin,
    framingBox,
    getThreeState,
    object,
  ]);

  return null;
}

export function Scene(props: SceneProps) {
  const [avatarScene, setAvatarScene] = useState<THREE.Object3D | null>(null);
  const [avatarFramingBox, setAvatarFramingBox] =
    useState<THREE.Box3 | null>(null);
  const [grounding, setGrounding] = useState<Grounding | null>(null);
  const handleAvatarReady = useCallback(
    (
      scene: THREE.Object3D,
      landmarks: HumanoidFramingLandmarks | null,
    ) => {
      setAvatarScene(scene);
      scene.updateWorldMatrix(true, true);
      const sceneBox = new THREE.Box3().setFromObject(scene);
      if (sceneBox.isEmpty()) {
        setAvatarFramingBox(null);
        setGrounding(null);
        return;
      }
      const box = landmarks
        ? humanoidFramingBox(sceneBox, landmarks)
        : sceneBox;
      setAvatarFramingBox(box);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      setGrounding({
        far: Math.max(size.y, 1),
        position: [
          center.x,
          (landmarks?.feet.y ?? box.min.y) + 0.005,
          center.z,
        ],
        scale: Math.max(size.x, size.z, 0.8) * 1.8,
      });
    },
    [],
  );

  return (
    <Canvas
      camera={{ position: [0, 2, 4.8], fov: 20 }}
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: true,
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      style={{ background: 'transparent' }}
    >
      <directionalLight
        color={[1, 1, 1]}
        position={[-3, 3, 3]}
        intensity={Math.PI}
      />
      <ambientLight
        color={[
          0.0036765073221525194,
          0.0036765073221525194,
          0.0036765073221525194,
        ]}
        intensity={Math.PI}
      />
      <Environment files={dawnEnvironment} />
      <FullBodyCamera
        characterSize={props.characterSize}
        framingBox={avatarFramingBox}
        framingMargin={props.framingMargin ?? 1.12}
        object={avatarScene}
      />
      <Avatar {...props} onReady={handleAvatarReady} />
      {props.groundShadow && grounding && (
        <ContactShadows
          blur={2.4}
          color="#050506"
          far={grounding.far}
          frames={1}
          key={`${props.modelUrl}-ground-shadow`}
          opacity={0.42}
          position={grounding.position}
          resolution={256}
          scale={grounding.scale}
        />
      )}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={props.enablePan ?? true}
        enableZoom
        minDistance={1.4}
        maxDistance={12}
        panSpeed={0.7}
        rotateSpeed={0.45}
        screenSpacePanning
        zoomSpeed={0.8}
      />
    </Canvas>
  );
}
