import { useCallback, useRef } from 'react';
import type { VRM } from '@pixiv/three-vrm';
import * as THREE from 'three';

const VISEMES = ['aa', 'ee', 'ih', 'oh', 'ou'] as const;
const VISEME_PATTERNS: readonly (readonly (typeof VISEMES)[number][])[] = [
  ['aa', 'oh', 'ee', 'ih', 'ou', 'aa', 'ee'],
  ['oh', 'aa', 'ih', 'ee', 'aa', 'ou', 'ih'],
  ['ee', 'ih', 'aa', 'ou', 'oh', 'ih', 'aa'],
  ['ou', 'oh', 'aa', 'ee', 'ih', 'aa', 'oh'],
];

export function characterMouthSeed(name: string): number {
  let hash = 2166136261;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function lipSyncTargets(
  phase: number,
  level: number,
  speaking: boolean,
  characterSeed = 0,
): Record<(typeof VISEMES)[number], number> {
  const pulse =
    0.24 +
    Math.abs(Math.sin(phase * (1.35 + characterSeed * 0.7))) * 0.76;
  const energy = speaking
    ? Math.min(1, Math.max(level * 7.5, 0.28 * pulse))
    : 0;
  const pattern =
    VISEME_PATTERNS[
      Math.min(
        VISEME_PATTERNS.length - 1,
        Math.floor(characterSeed * VISEME_PATTERNS.length),
      )
    ];
  const cursor = phase % pattern.length;
  const active = Math.floor(cursor);
  const blend = cursor - active;
  const currentViseme = pattern[active];
  const nextViseme = pattern[(active + 1) % pattern.length];
  return Object.fromEntries(
    VISEMES.map((viseme) => {
      const current = viseme === currentViseme ? 1 - blend : 0;
      const next = viseme === nextViseme ? blend : 0;
      const emphasis =
        viseme === 'aa' ? 0.08 + characterSeed * 0.08 : 0;
      return [viseme, Math.min(0.94, energy * (current + next + emphasis))];
    }),
  ) as Record<(typeof VISEMES)[number], number>;
}

export function useAmplitudeLipSync(vrm: VRM | null) {
  const smoothed = useRef(0);
  const phase = useRef(0);
  const jawBinding = useRef<{
    base: THREE.Quaternion;
    node: THREE.Object3D;
    vrm: VRM;
  } | null>(null);

  return useCallback(
    (delta: number, level: number, speaking: boolean) => {
      if (!vrm) return;
      const metaName =
        vrm.meta?.metaVersion === '1'
          ? vrm.meta.name
          : vrm.meta?.title;
      const seed = characterMouthSeed(
        metaName ?? vrm.scene.name ?? vrm.scene.uuid,
      );
      const pulse =
        0.24 +
        Math.abs(Math.sin(phase.current * (1.35 + seed * 0.7))) * 0.76;
      const normalized = speaking
        ? Math.min(1, Math.max(Math.max(0, level) * 7.5, 0.28 * pulse))
        : 0;
      const smoothing =
        1 -
        Math.exp(
          -delta / (normalized > smoothed.current ? 0.045 : 0.085),
        );
      smoothed.current += (normalized - smoothed.current) * smoothing;
      phase.current +=
        delta * (5.6 + seed * 1.8 + smoothed.current * 6.2);
      const targets = lipSyncTargets(
        phase.current,
        smoothed.current / 7.5,
        speaking || smoothed.current > 0.01,
        seed,
      );

      if (vrm.expressionManager) {
        for (const viseme of VISEMES) {
          if (vrm.expressionManager.getExpression(viseme)) {
            vrm.expressionManager.setValue(viseme, targets[viseme]);
          }
        }
      }

      if (jawBinding.current?.vrm !== vrm) {
        const node = vrm.humanoid?.getNormalizedBoneNode('jaw');
        jawBinding.current = node
          ? { base: node.quaternion.clone(), node, vrm }
          : null;
      }
      const jaw = jawBinding.current;
      if (jaw) {
        const jawOpen =
          Math.max(...Object.values(targets)) * (0.1 + seed * 0.08);
        const target = jaw.base
          .clone()
          .multiply(
            new THREE.Quaternion().setFromEuler(
              new THREE.Euler(jawOpen, 0, 0),
            ),
          );
        jaw.node.quaternion.slerp(
          target,
          1 - Math.exp(-delta / (speaking ? 0.04 : 0.08)),
        );
      }
    },
    [vrm],
  );
}
