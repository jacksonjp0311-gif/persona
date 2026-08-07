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
  type AnimationType,
} from './animation-catalog';
import {
  finishBodyAnimationOverride,
  type BodyAnimationOverride,
} from './animation-priority';
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

/** Always-on default dance when deployed and not speaking. */
const DEFAULT_DANCE_PRESET = 'freestyle-groove';
const DEFAULT_DANCE_NAME = 'freestyle-groove';
const EMPTY_ANIMATION_URLS: string[] = [];
/** How often AUTO mode rotates to another featured dance. */
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
        // User lock wins over ambient rotation from main.
        if (source === 'ambient' && lockedDanceIdRef.current != null) {
          return;
        }
        // Commands (one-shots) still apply; ambient is handled client-side.
        if (source === 'ambient') {
          // Prefer client auto-rotate; accept main ambient only if unlocked.
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
          return;
        }
        setBodyOverride({
          animation: event.animation,
          animationName: event.animationName,
          animationUrls:
            event.animation === 'DANCE' && event.proceduralPreset
              ? EMPTY_ANIMATION_URLS
              : event.animationUrls,
          mirror: event.animation === 'DANCE' ? false : event.mirror,
          proceduralPreset: event.proceduralPreset,
          requestId: event.requestId,
          source,
        });
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
      const preset =
        dance?.proceduralPreset ?? DEFAULT_DANCE_PRESET;
      const name = dance?.animationName ?? DEFAULT_DANCE_NAME;
      setBodyOverride({
        animation: 'DANCE',
        animationName: name,
        animationUrls: EMPTY_ANIMATION_URLS,
        mirror: false,
        proceduralPreset: preset,
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
    // Immediately resume continuous auto dance (no idle freeze).
    const next =
      danceOptions[
        autoIndexRef.current % Math.max(danceOptions.length, 1)
      ] ?? null;
    startDance(next, 'ambient');
  }, [danceOptions, startDance]);

  // Non-stop dancing while deployed (client-driven — does not wait on main).
  useEffect(() => {
    if (speaking) {
      setBodyOverride((current) =>
        current?.source === 'ambient' || current?.source === 'user'
          ? null
          : current,
      );
      return;
    }

    if (lockedDanceId != null) {
      setBodyOverride((current) => {
        if (current?.source === 'user' && current.proceduralPreset) {
          return current;
        }
        const locked = danceOptions.find((d) => d.id === lockedDanceId);
        danceRequestId.current += 1;
        return {
          animation: 'DANCE',
          animationName:
            locked?.animationName ?? DEFAULT_DANCE_NAME,
          animationUrls: EMPTY_ANIMATION_URLS,
          mirror: false,
          proceduralPreset:
            locked?.proceduralPreset ?? DEFAULT_DANCE_PRESET,
          requestId: danceRequestId.current,
          source: 'user',
        };
      });
      return;
    }

    // AUTO: ensure a dance is active once, then interval rotates it.
    setBodyOverride((current) => {
      if (current?.source === 'ambient' && current.proceduralPreset) {
        return current;
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
        proceduralPreset:
          seed?.proceduralPreset ?? DEFAULT_DANCE_PRESET,
        requestId: danceRequestId.current,
        source: 'ambient',
      };
    });
  }, [danceOptions, lockedDanceId, speaking]);

  // AUTO mode: rotate featured dances forever.
  useEffect(() => {
    if (speaking || lockedDanceId != null) {
      return;
    }
    const timer = window.setInterval(() => {
      if (danceOptions.length === 0) {
        startDance(null, 'ambient');
        return;
      }
      autoIndexRef.current =
        (autoIndexRef.current + 1) % danceOptions.length;
      const next = danceOptions[autoIndexRef.current];
      startDance(next, 'ambient');
    }, AUTO_DANCE_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [danceOptions, lockedDanceId, speaking, startDance]);

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

  // Body animation: talk while speaking, otherwise always dance.
  const animation: AnimationType = speaking
    ? 'TALK'
    : bodyOverride != null &&
        bodyOverride.animation !== 'DANCE' &&
        bodyOverride.animation !== 'CUSTOM'
      ? bodyOverride.animation
      : 'DANCE';

  const animationRequest = bodyOverride?.requestId ?? 0;

  const talkUrls = useMemo(
    () => animationUrlsForType(settings.animations, 'TALK'),
    [settings.animations],
  );

  const animationUrls = speaking
    ? talkUrls
    : EMPTY_ANIMATION_URLS;

  const proceduralPreset = speaking
    ? 'conversational-talk'
    : (bodyOverride?.proceduralPreset ?? DEFAULT_DANCE_PRESET);

  const overrideRequestId = bodyOverride?.requestId ?? null;
  const handleAnimationComplete = useCallback(() => {
    if (overrideRequestId == null) return;
    if (
      bodyOverride?.source === 'user' ||
      bodyOverride?.source === 'ambient'
    ) {
      return;
    }
    setBodyOverride((current) =>
      finishBodyAnimationOverride(current, overrideRequestId),
    );
  }, [bodyOverride?.source, overrideRequestId]);

  return deployedCharacters.length > 0 ? (
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
        characterSize={settings.character_size}
        mirror={false}
        characters={deployedCharacters}
        onAnimationComplete={handleAnimationComplete}
        playback="loop"
        proceduralPreset={proceduralPreset}
        speaking={speaking}
      />
    </main>
  ) : (
    <main className="app" />
  );
}
