import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { chooseSynchronizedAnimationUrls } from '../crew-animation';
import { createCrewLayout } from '../crew-layout';
import { MAX_CREW_SIZE } from '../crew-roster';

export interface SceneCharacter {
  id: string;
  modelUrl: string;
}

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
  characters?: readonly SceneCharacter[];
  modelUrl?: string;
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
  const characters = useMemo(
    () =>
      (
        props.characters ??
        (props.modelUrl
          ? [{ id: props.modelUrl, modelUrl: props.modelUrl }]
          : [])
      ).slice(0, MAX_CREW_SIZE),
    [props.characters, props.modelUrl],
  );
  const characterKey = characters
    .map((character) => character.id)
    .join('|');
  const layout = useMemo(
    () =>
      characters.length > 0 ? createCrewLayout(characters.length) : [],
    [characters.length],
  );
  const animationSelectionKey = `${props.animation}:${props.animationRequest}`;
  const synchronizedAnimationUrls = useMemo(
    () => {
      void animationSelectionKey;
      return chooseSynchronizedAnimationUrls(props.animationUrls ?? []);
    },
    [animationSelectionKey, props.animationUrls],
  );
  const [crewRoot, setCrewRoot] = useState<THREE.Group | null>(null);
  const [avatarFramingBox, setAvatarFramingBox] =
    useState<THREE.Box3 | null>(null);
  const [grounding, setGrounding] = useState<Grounding | null>(null);
  const readyAvatars = useRef<{
    avatars: Map<string, { box: THREE.Box3; feetY: number }>;
    key: string;
  }>({
    avatars: new Map(),
    key: '',
  });

  const completionKey = `${characterKey}:${props.animation}:${props.animationRequest}:${synchronizedAnimationUrls.join('|')}`;
  const completionState = useRef({
    completed: new Set<string>(),
    key: '',
    notified: false,
  });
  const onAnimationComplete = props.onAnimationComplete;

  const handleAnimationComplete = useCallback(
    (characterId: string) => {
      if (completionState.current.key !== completionKey) {
        completionState.current = {
          completed: new Set<string>(),
          key: completionKey,
          notified: false,
        };
      }
      const state = completionState.current;
      if (state.notified) return;
      state.completed.add(characterId);
      if (
        characters.length > 0 &&
        characters.every((character) =>
          state.completed.has(character.id),
        )
      ) {
        state.notified = true;
        onAnimationComplete();
      }
    },
    [
      characters,
      completionKey,
      onAnimationComplete,
    ],
  );

  const handleAvatarReady = useCallback(
    (
      characterId: string,
      scene: THREE.Object3D,
      landmarks: HumanoidFramingLandmarks | null,
    ) => {
      if (readyAvatars.current.key !== characterKey) {
        readyAvatars.current = {
          avatars: new Map(),
          key: characterKey,
        };
      }
      const roster = readyAvatars.current.avatars;
      scene.updateWorldMatrix(true, true);
      const sceneBox = new THREE.Box3().setFromObject(scene);
      if (sceneBox.isEmpty()) {
        roster.delete(characterId);
        return;
      }
      const box = landmarks
        ? humanoidFramingBox(sceneBox, landmarks)
        : sceneBox;
      roster.set(characterId, {
        box,
        feetY: landmarks?.feet.y ?? box.min.y,
      });
      const combinedBox = new THREE.Box3();
      let feetY = Number.POSITIVE_INFINITY;
      for (const ready of roster.values()) {
        combinedBox.union(ready.box);
        feetY = Math.min(feetY, ready.feetY);
      }
      if (combinedBox.isEmpty()) return;
      setAvatarFramingBox(combinedBox);
      const center = combinedBox.getCenter(new THREE.Vector3());
      const size = combinedBox.getSize(new THREE.Vector3());
      setGrounding({
        far: Math.max(size.y, 1),
        position: [
          center.x,
          feetY + 0.005,
          center.z,
        ],
        scale: Math.max(size.x, size.z, 0.8) * 1.8,
      });
    },
    [characterKey],
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
        object={crewRoot}
      />
      <group ref={setCrewRoot}>
        {characters.map((character, index) => (
          <Avatar
            animation={props.animation}
            animationRequest={props.animationRequest}
            animationUrls={synchronizedAnimationUrls}
            audioLevel={index === 0 ? props.audioLevel : 0}
            characterId={character.id}
            key={character.id}
            mirror={props.mirror}
            modelUrl={character.modelUrl}
            onAnimationComplete={handleAnimationComplete}
            onReady={handleAvatarReady}
            playback={props.playback}
            position={layout[index]?.position}
            proceduralPreset={props.proceduralPreset}
            scale={layout[index]?.scale}
            speaking={index === 0 && props.speaking}
          />
        ))}
      </group>
      {props.groundShadow && grounding && (
        <ContactShadows
          blur={2.4}
          color="#050506"
          far={grounding.far}
          frames={1}
          key={`${characterKey}-ground-shadow`}
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
