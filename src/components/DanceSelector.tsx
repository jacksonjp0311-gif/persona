import { useMemo, useState, type CSSProperties, type WheelEvent } from 'react';

export interface DanceOption {
  id: string;
  label: string;
  animationName: string;
  animationUrls: string[];
  proceduralPreset: string | null;
}

interface DanceSelectorProps {
  dances: readonly DanceOption[];
  lockedDanceId: string | null;
  onLockDance: (dance: DanceOption) => void;
  onUnlockAuto: () => void;
}

function initials(label: string): string {
  const parts = label.trim().split(/[\s-_]+/).filter(Boolean);
  if (parts.length === 0) return '♪';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function DanceSelector({
  dances,
  lockedDanceId,
  onLockDance,
  onUnlockAuto,
}: DanceSelectorProps) {
  const [hovered, setHovered] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);

  const items = useMemo(() => dances.slice(0, 16), [dances]);
  const activeIndex = useMemo(() => {
    if (lockedDanceId == null) return -1;
    return items.findIndex((dance) => dance.id === lockedDanceId);
  }, [items, lockedDanceId]);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (items.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const direction = event.deltaY > 0 ? 1 : -1;
    const base = activeIndex >= 0 ? activeIndex : focusIndex;
    const next = (base + direction + items.length) % items.length;
    setFocusIndex(next);
    onLockDance(items[next]);
  };

  return (
    <div
      aria-label="Dance selector"
      className={`dance-selector ${hovered ? 'is-open' : ''}`}
      data-persona-interactive="dance"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onWheel={handleWheel}
      role="toolbar"
    >
      <div className="dance-selector-hotzone" aria-hidden="true" />
      <div className="dance-selector-panel">
        <div className="dance-wheel" aria-hidden={!hovered}>
          <div className="dance-wheel-ring" />
          {items.map((dance, index) => {
            const angle = (index / Math.max(items.length, 1)) * 360 - 90;
            const selected = dance.id === lockedDanceId;
            const focused = index === focusIndex || selected;
            return (
              <button
                aria-label={`Play ${dance.label}`}
                aria-pressed={selected}
                className={`dance-wheel-item ${selected ? 'selected' : ''} ${
                  focused ? 'focused' : ''
                }`}
                key={dance.id}
                onClick={(event) => {
                  event.stopPropagation();
                  setFocusIndex(index);
                  onLockDance(dance);
                }}
                style={
                  {
                    '--dance-angle': `${angle}deg`,
                  } as CSSProperties
                }
                title={dance.label}
                type="button"
              >
                <span className="dance-wheel-glyph" aria-hidden="true">
                  {initials(dance.label)}
                </span>
                <span className="dance-wheel-label">{dance.label}</span>
              </button>
            );
          })}
          <button
            aria-label="Auto rotate dances"
            aria-pressed={lockedDanceId == null}
            className={`dance-wheel-core ${
              lockedDanceId == null ? 'selected' : ''
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onUnlockAuto();
            }}
            title="Auto dance rotation"
            type="button"
          >
            <strong>{lockedDanceId == null ? 'AUTO' : '♪'}</strong>
            <small>
              {lockedDanceId == null
                ? 'Shuffle'
                : items.find((dance) => dance.id === lockedDanceId)?.label ??
                  'Locked'}
            </small>
          </button>
        </div>
        <p className="dance-selector-hint">
          Hover · click a move · scroll to cycle
        </p>
      </div>
    </div>
  );
}
