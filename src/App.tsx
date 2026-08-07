import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Scene } from './components/Scene';
import { OverlayChrome } from './components/OverlayChrome';
import { OverlayPointerPassthrough } from './components/OverlayPointerPassthrough';
import {
  DanceSelector,
  type DanceOption,
} from './components/DanceSelector';
import {
  animationUrlsForType,
  type PlayableAnimationType,
} from './animation-catalog';
import { type BodyAnimationOverride } from './animation-priority';
import {
  loadPackagedSettingsFallback,
  SETTINGS_FALLBACK,
} from './settings-defaults';
import { resolveDeployedModels } from './crew-roster';
import {
  FEATURED_DANCE_IDS,
  FEATURED_DANCE_LABELS,
  isFeaturedDanceId,
} from './dance-catalog';

const INITIAL_STATE: VoiceState = {
  activity: 'idle',
  microphoneMuted: false,
  outputMuted: false,
  phase: 'inactive',
};

const DEFAULT_DANCE_PRESET = 'freestyle-groove';
const DEFAULT_DANCE_NAME = 'freestyle-groove';
const EMPTY_ANIMATION_URLS: string[] = [];
const AUTO_DANCE_ROTATE_MS = 12_000;

export function App() {
  const [voice, setVoice] = useState<VoiceState>(INITIAL_STATE);
  const [audioLevel, setAudioLevel] = useState(0);
  const [bodyOverride, setBodyOverride] =
    useState<BodyAnimationOverride | null>(null);
  const [settings, setSettings] =
    useState<PersonaSettingsSnapshot>(SETTINGS_FALLBACK);
  const [lockedDanceId, setLockedDanceId] = useState<string | null>(null);
  const danceRequestId = useRef(0);
  const lockedDanceIdRef = useRef<string | null>(null);
  const autoIndexRef = useRef(0);

  useEffect(() => {
    lockedDanceIdRef.current = lockedDanceId;
  }, [lockedDanceId]);

  useEffect(() => {
    const bridge = window.personaBridge;
    if (!bridge) return;
    void bridge.getSnapshot().then((event) => {
      if (event?.type === 'state') setVoice(event.state);
    });
    return bridge.subscribe((event) => {
      if (event.type === 'state') {
        setVoice(event.state);
      } else if (event.type === 'audio-level') {
        setAudioLevel(event.level);
      } else if (event.type === 'animation') {
        if (event.requestId == null) return;
        const source = event.source ?? 'command';
        // User-locked dance wins over ambient shuffle.
        if (source === 'ambient' && lockedDanceIdRef.current != null) {
          return;
        }
        // Command/MCP actions must always apply and must not be stomped.
        if (source === 'command') {
          setBodyOverride({
            animation: event.animation,
            animationName: event.animationName,
            animationUrls: event.animationUrls,
            mirror: event.mirror ?? false,
            proceduralPreset: event.proceduralPreset,
            requestId: event.requestId,
            source: 'command',
          });
          return;
        }
        if (source === 'ambient') {
          setBodyOverride({
            animation: 'DANCE',
            animationName: event.animationName ?? DEFAULT_DANCE_NAME,
            animationUrls: EMPTY_ANIMATION_URLS,
            mirror: false,
            proceduralPreset:
              event.proceduralPreset ?? DEFAULT_DANCE_PRESET,
            requestId: event.requestId,
            source: 'ambient',
          });
        }
      }
    });
  }, []);

  useEffect(() => {
    const settingsBridge = window.personaSettings;
    if (!settingsBridge) {
      void loadPackagedSettingsFallback().then(setSettings);
      return;
    }
    void settingsBridge.get().then(setSettings);
    return settingsBridge.subscribe(setSettings);
  }, []);

  const speaking =
    voice.phase === 'active' &&
    voice.activity === 'speaking' &&
    !voice.outputMuted;

  const danceOptions = useMemo<DanceOption[]>(() => {
    const byId = new Map(
      settings.animations.map((animation) => [animation.id, animation]),
    );
    const featured = FEATURED_DANCE_IDS.flatMap((id) => {
      const animation = byId.get(id);
      if (!animation?.procedural_preset) return [];
      return [
        {
          id: animation.id,
          label: isFeaturedDanceId(animation.id)
            ? FEATURED_DANCE_LABELS[animation.id]
            : animation.animation_name,
          animationName: animation.animation_name,
          animationUrls: EMPTY_ANIMATION_URLS,
          proceduralPreset: animation.procedural_preset,
        } satisfies DanceOption,
      ];
    });
    if (featured.length > 0) return featured;
    return settings.animations
      .filter(
        (animation) =>
          animation.animation_type === 'DANCE' &&
          animation.procedural_preset != null,
      )
      .slice(0, 8)
      .map((animation) => ({
        id: animation.id,
        label: animation.animation_name,
        animationName: animation.animation_name,
        animationUrls: EMPTY_ANIMATION_URLS,
        proceduralPreset: animation.procedural_preset,
      }));
  }, [settings.animations]);

  const startDance = useCallback(
    (
      dance: Pick<
        DanceOption,
        'animationName' | 'proceduralPreset' | 'id'
      > | null,
      source: 'ambient' | 'user',
    ) => {
      danceRequestId.current += 1;
      setBodyOverride({
        animation: 'DANCE',
        animationName: dance?.animationName ?? DEFAULT_DANCE_NAME,
        animationUrls: EMPTY_ANIMATION_URLS,
        mirror: false,
        proceduralPreset: dance?.proceduralPreset ?? DEFAULT_DANCE_PRESET,
        requestId: danceRequestId.current,
        source,
      });
    },
    [],
  );

  const applyUserDance = useCallback(
    (dance: DanceOption) => {
      setLockedDanceId(dance.id);
      startDance(dance, 'user');
    },
    [startDance],
  );

  const unlockAutoDance = useCallback(() => {
    setLockedDanceId(null);
    const next =
      danceOptions[
        autoIndexRef.current % Math.max(danceOptions.length, 1)
      ] ?? null;
    startDance(next, 'ambient');
  }, [danceOptions, startDance]);

  // Keep a dance running when idle — never overwrite MCP/command actions.
  useEffect(() => {
    if (speaking) return;

    setBodyOverride((current) => {
      // Let one-shot MCP/protocol actions finish.
      if (current?.source === 'command') return current;

      if (lockedDanceId != null) {
        if (current?.source === 'user' && current.proceduralPreset) {
          return current;
        }
        const locked = danceOptions.find((d) => d.id === lockedDanceId);
        danceRequestId.current += 1;
        return {
          animation: 'DANCE',
          animationName: locked?.animationName ?? DEFAULT_DANCE_NAME,
          animationUrls: EMPTY_ANIMATION_URLS,
          mirror: false,
          proceduralPreset:
            locked?.proceduralPreset ?? DEFAULT_DANCE_PRESET,
          requestId: danceRequestId.current,
          source: 'user',
        };
      }

      if (current?.source === 'ambient' && current.proceduralPreset) {
        return current;
      }
      if (current?.source === 'user' && lockedDanceId == null) {
        // Fall through to ambient after unlock.
      }

      const seed =
        danceOptions[
          autoIndexRef.current % Math.max(danceOptions.length, 1)
        ] ?? null;
      danceRequestId.current += 1;
      return {
        animation: 'DANCE',
        animationName: seed?.animationName ?? DEFAULT_DANCE_NAME,
        animationUrls: EMPTY_ANIMATION_URLS,
        mirror: false,
        proceduralPreset: seed?.proceduralPreset ?? DEFAULT_DANCE_PRESET,
        requestId: danceRequestId.current,
        source: 'ambient',
      };
    });
  }, [danceOptions, lockedDanceId, speaking]);

  // AUTO shuffle — skip while a command action owns the body.
  useEffect(() => {
    if (speaking || lockedDanceId != null) return;
    const timer = window.setInterval(() => {
      setBodyOverride((current) => {
        if (current?.source === 'command') return current;
        if (danceOptions.length === 0) {
          danceRequestId.current += 1;
          return {
            animation: 'DANCE',
            animationName: DEFAULT_DANCE_NAME,
            animationUrls: EMPTY_ANIMATION_URLS,
            mirror: false,
            proceduralPreset: DEFAULT_DANCE_PRESET,
            requestId: danceRequestId.current,
            source: 'ambient',
          };
        }
        autoIndexRef.current =
          (autoIndexRef.current + 1) % danceOptions.length;
        const next = danceOptions[autoIndexRef.current];
        danceRequestId.current += 1;
        return {
          animation: 'DANCE',
          animationName: next.animationName,
          animationUrls: EMPTY_ANIMATION_URLS,
          mirror: false,
          proceduralPreset: next.proceduralPreset ?? DEFAULT_DANCE_PRESET,
          requestId: danceRequestId.current,
          source: 'ambient',
        };
      });
    }, AUTO_DANCE_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [danceOptions, lockedDanceId, speaking]);

  const deployedModels = useMemo(
    () => resolveDeployedModels(settings),
    [settings],
  );
  const deployedCharacters = useMemo(
    () =>
      deployedModels.map((model) => ({
        id: model.id,
        modelUrl: model.asset_url,
      })),
    [deployedModels],
  );

  const commandActive = bodyOverride?.source === 'command';

  const animation: PlayableAnimationType = speaking
    ? 'TALK'
    : commandActive && bodyOverride
      ? bodyOverride.animation
      : 'DANCE';

  const animationRequest = bodyOverride?.requestId ?? 0;

  const talkUrls = useMemo(
    () => animationUrlsForType(settings.animations, 'TALK'),
    [settings.animations],
  );

  const animationUrls = speaking
    ? talkUrls
    : commandActive
      ? (bodyOverride?.animationUrls ?? EMPTY_ANIMATION_URLS)
      : EMPTY_ANIMATION_URLS;

  const proceduralPreset = speaking
    ? 'conversational-talk'
    : commandActive
      ? (bodyOverride?.proceduralPreset ?? null)
      : (bodyOverride?.proceduralPreset ?? DEFAULT_DANCE_PRESET);

  const handleAnimationComplete = useCallback(() => {
    setBodyOverride((current) => {
      if (current?.source !== 'command') return current;
      // Resume continuous dance after a one-shot MCP/protocol action.
      danceRequestId.current += 1;
      return {
        animation: 'DANCE',
        animationName: DEFAULT_DANCE_NAME,
        animationUrls: EMPTY_ANIMATION_URLS,
        mirror: false,
        proceduralPreset: DEFAULT_DANCE_PRESET,
        requestId: danceRequestId.current,
        source: 'ambient',
      };
    });
  }, []);

  if (deployedCharacters.length === 0) {
    return <main className="app" />;
  }

  return (
    <main className="app">
      <OverlayPointerPassthrough />
      <OverlayChrome />
      <DanceSelector
        dances={danceOptions}
        lockedDanceId={lockedDanceId}
        onLockDance={applyUserDance}
        onUnlockAuto={unlockAutoDance}
      />
      <Scene
        animation={animation}
        animationRequest={animationRequest}
        animationUrls={animationUrls}
        audioLevel={audioLevel}
        characterSize={settings.character_size || 1}
        mirror={bodyOverride?.mirror ?? false}
        characters={deployedCharacters}
        onAnimationComplete={handleAnimationComplete}
        playback={commandActive ? 'once' : 'loop'}
        proceduralPreset={proceduralPreset}
        speaking={speaking}
      />
    </main>
  );
}
