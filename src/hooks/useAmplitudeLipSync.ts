import { useCallback, useRef } from 'react';
import type { VRM } from '@pixiv/three-vrm';

const VISEMES = ['aa', 'ee', 'ih', 'oh', 'ou'] as const;

export function lipSyncTargets(
  phase: number,
  level: number,
  speaking: boolean,
): Record<(typeof VISEMES)[number], number> {
  const pulse = 0.32 + Math.abs(Math.sin(phase * 1.7)) * 0.68;
  const energy = speaking
    ? Math.min(1, Math.max(level * 7.5, 0.32 * pulse))
    : 0;
  const cursor = phase % VISEMES.length;
  const active = Math.floor(cursor);
  const blend = cursor - active;
  return Object.fromEntries(
    VISEMES.map((viseme, index) => {
      const current = index === active ? 1 - blend : 0;
      const next = index === (active + 1) % VISEMES.length ? blend : 0;
      const emphasis = viseme === 'aa' ? 0.18 : 0;
      return [viseme, Math.min(0.92, energy * (current + next + emphasis))];
    }),
  ) as Record<(typeof VISEMES)[number], number>;
}

export function useAmplitudeLipSync(vrm: VRM | null) {
  const smoothed = useRef(0);
  const phase = useRef(0);

  return useCallback(
    (delta: number, level: number, speaking: boolean) => {
      if (!vrm?.expressionManager) return;
      const pulse = 0.32 + Math.abs(Math.sin(phase.current * 1.7)) * 0.68;
      const normalized = speaking
        ? Math.min(1, Math.max(Math.max(0, level) * 7.5, 0.32 * pulse))
        : 0;
      const smoothing =
        1 -
        Math.exp(
          -delta / (normalized > smoothed.current ? 0.045 : 0.085),
        );
      smoothed.current += (normalized - smoothed.current) * smoothing;
      phase.current += delta * (4.8 + smoothed.current * 5.5);
      const targets = lipSyncTargets(
        phase.current,
        smoothed.current / 7.5,
        speaking || smoothed.current > 0.01,
      );

      for (const viseme of VISEMES) {
        vrm.expressionManager.setValue(viseme, targets[viseme]);
      }
    },
    [vrm],
  );
}
