import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Scene } from './components/Scene';
import { OverlayChrome } from './components/OverlayChrome';
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

export function App() {
  const [voice, setVoice] = useState<VoiceState>(INITIAL_STATE);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceAnimation, setVoiceAnimation] = useState<AnimationType>('IDLE');
  const [bodyOverride, setBodyOverride] =
    useState<BodyAnimationOverride | null>(null);
  const [settings, setSettings] =
    useState<PersonaSettingsSnapshot>(SETTINGS_FALLBACK);

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
          setBodyOverride({
            animation: event.animation,
            animationName: event.animationName,
            animationUrls: event.animationUrls,
            mirror: event.mirror,
            proceduralPreset: event.proceduralPreset,
            requestId: event.requestId,
            source: event.source ?? 'command',
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
  // Listening/idle must not freeze the avatar into a rest pose.
  const ambientDanceAllowed = !speaking;

  useEffect(() => {
    if (
      bodyOverride?.source === 'ambient' &&
      !ambientDanceAllowed
    ) {
      setBodyOverride(null);
    }
  }, [ambientDanceAllowed, bodyOverride]);

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
  const proceduralPreset =
    bodyOverride?.proceduralPreset ??
    (voice.phase === 'active' && voice.activity === 'listening'
      ? 'calm-listen'
      : configuredProceduralPreset);
  const overrideRequestId = bodyOverride?.requestId ?? null;
  const handleAnimationComplete = useCallback(() => {
    if (overrideRequestId == null) return;
    setBodyOverride((current) =>
      finishBodyAnimationOverride(current, overrideRequestId),
    );
  }, [overrideRequestId]);

  return deployedCharacters.length > 0 ? (
    <main className="app">
      <OverlayChrome />
      <Scene
        animation={animation}
        animationRequest={animationRequest}
        animationUrls={animationUrls}
        audioLevel={audioLevel}
        characterSize={settings.character_size}
        mirror={bodyOverride?.mirror ?? false}
        characters={deployedCharacters}
        onAnimationComplete={handleAnimationComplete}
        playback={
          bodyOverride == null || bodyOverride.source === 'ambient'
            ? 'loop'
            : 'once'
        }
        proceduralPreset={proceduralPreset}
        speaking={speaking}
      />
    </main>
  ) : (
    <main className="app" />
  );
}
