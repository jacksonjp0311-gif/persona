import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Scene } from './components/Scene';
import { OverlayChrome } from './components/OverlayChrome';
import {
  DanceSelector,
  type DanceOption,
} from './components/DanceSelector';
import {
  animationUrlsForType,
  immediateVoiceAnimation,
  proceduralPresetForType,
  type AnimationType,
} from './animation-catalog';
import {
  finishBodyAnimationOverride,
  resolveBodyAnimation,
  type BodyAnimationOverride,
} from './animation-priority';
import {
  loadPackagedSettingsFallback,
  SETTINGS_FALLBACK,
} from './settings-defaults';
import { resolveDeployedModels } from './crew-roster';

const INITIAL_STATE: VoiceState = {
  activity: 'idle',
  microphoneMuted: false,
  outputMuted: false,
  phase: 'inactive',
};

const BODY_IDLE_DELAY_MS = 650;

function prettyDanceLabel(name: string): string {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function App() {
  const [voice, setVoice] = useState<VoiceState>(INITIAL_STATE);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceAnimation, setVoiceAnimation] = useState<AnimationType>('IDLE');
  const [bodyOverride, setBodyOverride] =
    useState<BodyAnimationOverride | null>(null);
  const [settings, setSettings] =
    useState<PersonaSettingsSnapshot>(SETTINGS_FALLBACK);
  const [lockedDanceId, setLockedDanceId] = useState<string | null>(null);
  const userDanceRequestId = useRef(0);
  const lockedDanceIdRef = useRef<string | null>(null);

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
        if (event.requestId != null) {
          const source = event.source ?? 'command';
          // User-locked dances win over ambient rotation.
          if (source === 'ambient' && lockedDanceIdRef.current != null) {
            return;
          }
          setBodyOverride({
            animation: event.animation,
            animationName: event.animationName,
            animationUrls: event.animationUrls,
            mirror: event.mirror,
            proceduralPreset: event.proceduralPreset,
            requestId: event.requestId,
            source,
          });
        } else if (event.animation !== 'CUSTOM') {
          setVoiceAnimation(event.animation);
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

  // Keep the desktop character dancing whenever it is not mid-speech.
  const ambientDanceAllowed = !speaking;

  const danceOptions = useMemo<DanceOption[]>(
    () =>
      settings.animations
        .filter(
          (animation) =>
            animation.animation_type === 'DANCE' &&
            (animation.asset_urls.length > 0 ||
              animation.procedural_preset != null),
        )
        .map((animation) => ({
          id: animation.id,
          label: prettyDanceLabel(animation.animation_name),
          animationName: animation.animation_name,
          animationUrls: animation.asset_urls,
          proceduralPreset: animation.procedural_preset,
        })),
    [settings.animations],
  );

  const applyUserDance = useCallback((dance: DanceOption) => {
    userDanceRequestId.current += 1;
    setLockedDanceId(dance.id);
    setBodyOverride({
      animation: 'DANCE',
      animationName: dance.animationName,
      animationUrls: dance.animationUrls,
      mirror: false,
      proceduralPreset: dance.proceduralPreset,
      requestId: userDanceRequestId.current,
      source: 'user',
    });
  }, []);

  const unlockAutoDance = useCallback(() => {
    setLockedDanceId(null);
    // Drop the lock so ambient rotation can take over again.
    setBodyOverride((current) =>
      current?.source === 'user' ? null : current,
    );
  }, []);

  useEffect(() => {
    if (!ambientDanceAllowed) {
      if (
        bodyOverride?.source === 'ambient' ||
        bodyOverride?.source === 'user'
      ) {
        setBodyOverride(null);
      }
      return;
    }
    if (lockedDanceId == null) return;
    if (bodyOverride?.source === 'user' && bodyOverride.animationName) return;
    const dance = danceOptions.find((option) => option.id === lockedDanceId);
    if (dance) applyUserDance(dance);
  }, [
    ambientDanceAllowed,
    applyUserDance,
    bodyOverride,
    danceOptions,
    lockedDanceId,
  ]);

  useEffect(() => {
    const immediateAnimation = immediateVoiceAnimation(voice);
    if (immediateAnimation != null) {
      setVoiceAnimation(immediateAnimation);
      if (immediateAnimation === 'IDLE') setAudioLevel(0);
      return;
    }

    const timer = window.setTimeout(
      () => setVoiceAnimation('IDLE'),
      BODY_IDLE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [voice]);

  const animation = resolveBodyAnimation(voiceAnimation, bodyOverride);
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
  const animationRequest = bodyOverride?.requestId ?? 0;
  const configuredAnimationUrls = useMemo(
    () => animationUrlsForType(settings.animations, animation),
    [animation, settings.animations],
  );
  const animationUrls =
    bodyOverride?.animationUrls ?? configuredAnimationUrls;
  const configuredProceduralPreset = useMemo(
    () => proceduralPresetForType(settings.animations, animation),
    [animation, settings.animations],
  );
  // Prefer the active dance override. Avoid forcing calm-listen over dance
  // while the voice runtime is merely listening.
  const proceduralPreset =
    bodyOverride?.proceduralPreset ??
    (animation === 'DANCE'
      ? configuredProceduralPreset
      : voice.phase === 'active' &&
          voice.activity === 'listening' &&
          bodyOverride == null
        ? 'calm-listen'
        : configuredProceduralPreset);
  const overrideRequestId = bodyOverride?.requestId ?? null;
  const handleAnimationComplete = useCallback(() => {
    if (overrideRequestId == null) return;
    // User-locked and ambient dances loop; never clear them on complete.
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

  const loopingOverride =
    bodyOverride == null ||
    bodyOverride.source === 'ambient' ||
    bodyOverride.source === 'user';

  return deployedCharacters.length > 0 ? (
    <main className="app">
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
        mirror={bodyOverride?.mirror ?? false}
        characters={deployedCharacters}
        onAnimationComplete={handleAnimationComplete}
        playback={loopingOverride ? 'loop' : 'once'}
        proceduralPreset={proceduralPreset}
        speaking={speaking}
      />
    </main>
  ) : (
    <main className="app" />
  );
}
