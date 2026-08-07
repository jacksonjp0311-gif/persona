import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Scene } from './Scene';
import {
  animationUrlsForType,
  proceduralPresetForType,
  type PlayableAnimationType,
} from '../animation-catalog';
import {
  loadPackagedSettingsFallback,
  SETTINGS_FALLBACK,
} from '../settings-defaults';
import {
  applyTheme,
  LIGHT_QUERY,
  readStoredTheme,
  storeTheme,
  THEME_OPTIONS,
  type ThemePreference,
} from '../theme';
import { MAX_CREW_SIZE } from '../crew-roster';
import {
  randomCrew,
  sameCrew,
  toggleCrewMember,
} from '../crew-selection';

type SettingsSection = 'models' | 'animations' | 'appearance' | 'mcp';
interface ConfirmationRequest {
  confirmLabel: string;
  detail: string;
  onConfirm: () => Promise<void>;
  title: string;
}

const SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  description: string;
}> = [
  { id: 'models', label: 'Models', description: 'Character library' },
  { id: 'animations', label: 'Actions', description: 'Motion library' },
  { id: 'appearance', label: 'Appearance', description: 'Default framing' },
  { id: 'mcp', label: 'MCP', description: 'Agent connection' },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.4"
      viewBox="0 0 16 16"
    >
      {children}
    </svg>
  );
}

const SECTION_ICONS: Record<SettingsSection, ReactNode> = {
  models: (
    <Icon>
      <circle cx="8" cy="5.5" r="2.6" />
      <path d="M2.9 13.6c0-2.3 2.28-4.1 5.1-4.1s5.1 1.8 5.1 4.1" />
    </Icon>
  ),
  animations: (
    <Icon>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M6.8 5.8 10.9 8l-4.1 2.2z" />
    </Icon>
  ),
  appearance: (
    <Icon>
      <path d="M2.6 5.6v-2a1 1 0 0 1 1-1h2M10.4 2.6h2a1 1 0 0 1 1 1v2M13.4 10.4v2a1 1 0 0 1-1 1h-2M5.6 13.4h-2a1 1 0 0 1-1-1v-2" />
    </Icon>
  ),
  mcp: (
    <Icon>
      <path d="M6 2.4v2.6M10 2.4v2.6M4.6 5h6.8v2.9A3.4 3.4 0 0 1 8 11.3 3.4 3.4 0 0 1 4.6 7.9z" />
      <path d="M8 11.3v2.3" />
    </Icon>
  ),
};

/** Tracks the stored preference and keeps the applied theme in sync with it. */
function useThemePreference() {
  const [preference, setPreference] =
    useState<ThemePreference>(readStoredTheme);
  const [systemPrefersLight, setSystemPrefersLight] = useState(
    () => window.matchMedia(LIGHT_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(LIGHT_QUERY);
    const sync = (event: MediaQueryListEvent) =>
      setSystemPrefersLight(event.matches);
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const resolved =
    preference === 'system' ? (systemPrefersLight ? 'light' : 'dark') : preference;

  useEffect(() => applyTheme(resolved), [resolved]);

  const chooseTheme = useCallback((next: ThemePreference) => {
    setPreference(next);
    storeTheme(next);
  }, []);

  return { chooseTheme, preference, resolved };
}

const MCP_TOOL_DESCRIPTIONS: Record<string, string> = {
  play_animation: 'Play any configured action with built-in motion or a clip.',
  list_animations: 'Read the latest playable actions and their usage details.',
  control_window: 'Show, hide, or toggle the Persona character window.',
  get_status: 'Read window, model, voice, and listener readiness.',
};

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

function modelInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const WHEEL_PAGE_SIZE = 12;
type ActionCategory =
  | 'all'
  | 'captured'
  | 'football'
  | 'dance'
  | 'conversation'
  | 'system'
  | 'custom';

const ACTION_CATEGORIES: Array<{
  id: ActionCategory;
  label: string;
}> = [
  { id: 'all', label: 'All' },
  { id: 'captured', label: 'Captured' },
  { id: 'dance', label: 'Dance' },
  { id: 'football', label: 'Football' },
  { id: 'conversation', label: 'Conversation' },
  { id: 'system', label: 'System' },
  { id: 'custom', label: 'Custom' },
];

function actionCategory(
  animation: PersonaAnimationSettings,
): Exclude<ActionCategory, 'all' | 'captured'> {
  if (animation.system) return 'system';
  if (animation.origin === 'user') return 'custom';
  if (animation.id.startsWith('nfl-')) return 'football';
  if (animation.id.startsWith('dance-')) return 'dance';
  return 'conversation';
}

export function SettingsPage() {
  const bridge = window.personaSettings;
  const { chooseTheme, preference: themePreference } = useThemePreference();
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [settings, setSettings] =
    useState<PersonaSettingsSnapshot>(SETTINGS_FALLBACK);
  const [section, setSection] = useState<SettingsSection>('models');
  const [selectedModelId, setSelectedModelId] = useState(
    SETTINGS_FALLBACK.default_model_id,
  );
  const crewSelectionDirty = useRef(false);
  const [deploymentMode, setDeploymentMode] = useState<'solo' | 'crew'>(
    SETTINGS_FALLBACK.deployment_mode,
  );
  const [crewModelIds, setCrewModelIds] = useState<string[]>(
    SETTINGS_FALLBACK.deployed_model_ids,
  );
  const [wheelPage, setWheelPage] = useState(0);
  const [previewAnimation, setPreviewAnimation] =
    useState<PersonaAnimationSettings | null>(null);
  const [previewClipId, setPreviewClipId] = useState<string | null>(null);
  const [previewRequest, setPreviewRequest] = useState(0);
  const [previewMouthTest, setPreviewMouthTest] = useState(false);
  const [actionFilter, setActionFilter] =
    useState<ActionCategory>('captured');
  const [cycleActions, setCycleActions] = useState(false);
  const [cycleIndex, setCycleIndex] = useState(0);
  const [modelName, setModelName] = useState('');
  const [animationMetadata, setAnimationMetadata] =
    useState<CustomAnimationMetadata>({
      animation_name: '',
      animation_description: '',
      animation_trigger_scenario: '',
    });
  const [editingAnimationId, setEditingAnimationId] = useState<string | null>(
    null,
  );
  const [editingAnimationMetadata, setEditingAnimationMetadata] =
    useState<CustomAnimationMetadata>({
      animation_name: '',
      animation_description: '',
      animation_trigger_scenario: '',
    });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mcpStatus, setMcpStatus] = useState<PersonaMcpStatus | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [cliConnected, setCliConnected] = useState(false);
  const [confirmation, setConfirmation] =
    useState<ConfirmationRequest | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmationDialogRef = useRef<HTMLDivElement>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const confirmationConfirmRef = useRef<HTMLButtonElement>(null);
  const settingsContentRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const syncDeploymentSelection = useCallback(
    (snapshot: PersonaSettingsSnapshot) => {
      if (crewSelectionDirty.current) return;
      setDeploymentMode(snapshot.deployment_mode);
      setCrewModelIds(
        snapshot.deployed_model_ids.length > 0
          ? snapshot.deployed_model_ids
          : snapshot.default_model_id
            ? [snapshot.default_model_id]
            : [],
      );
    },
    [],
  );

  useEffect(() => {
    document.title = 'Persona Settings';
    if (!bridge) {
      void loadPackagedSettingsFallback()
        .then((snapshot) => {
          setSettings(snapshot);
          setSelectedModelId(snapshot.default_model_id);
          syncDeploymentSelection(snapshot);
        })
        .catch((error: unknown) => setNotice(errorMessage(error)));
      return;
    }
    void bridge
      .get()
      .then((snapshot) => {
        setSettings(snapshot);
        setSelectedModelId(snapshot.default_model_id);
        syncDeploymentSelection(snapshot);
      })
      .catch((error: unknown) => setNotice(errorMessage(error)));
    return bridge.subscribe((snapshot) => {
      setSettings(snapshot);
      syncDeploymentSelection(snapshot);
    });
  }, [bridge, syncDeploymentSelection]);

  useEffect(() => {
    setPreviewAnimation((current) => {
      if (!current) return null;
      return (
        settings.animations.find((animation) => animation.id === current.id) ??
        null
      );
    });
    setPreviewClipId((current) => {
      if (!current) return null;
      return settings.animations.some((animation) =>
        animation.clips.some((clip) => clip.id === current),
      )
        ? current
        : null;
    });
  }, [settings.animations]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selectedModel =
    settings.models.find((model) => model.id === selectedModelId) ??
    settings.models.find((model) => model.id === settings.default_model_id) ??
    settings.models[0];
  const crewModels = useMemo(
    () =>
      crewModelIds
        .map((modelId) =>
          settings.models.find((model) => model.id === modelId),
        )
        .filter((model): model is PersonaModelSettings => model != null),
    [crewModelIds, settings.models],
  );
  const previewModels = useMemo(
    () =>
      deploymentMode === 'crew' && crewModels.length > 0
        ? crewModels
        : selectedModel
          ? [selectedModel]
          : [],
    [crewModels, deploymentMode, selectedModel],
  );
  const previewCharacters = useMemo(
    () =>
      previewModels.map((model) => ({
        id: model.id,
        modelUrl: model.asset_url,
      })),
    [previewModels],
  );
  const deploymentIsActive =
    settings.deployment_mode === deploymentMode &&
    (deploymentMode === 'crew'
      ? sameCrew(settings.deployed_model_ids, crewModelIds)
      : selectedModel?.id === settings.default_model_id);
  const wheelPageCount = Math.max(
    1,
    Math.ceil(settings.models.length / WHEEL_PAGE_SIZE),
  );
  const wheelModels = settings.models.slice(
    wheelPage * WHEEL_PAGE_SIZE,
    (wheelPage + 1) * WHEEL_PAGE_SIZE,
  );
  const activeModelIndex = settings.models.findIndex(
    (model) => model.id === settings.default_model_id,
  );

  useEffect(() => {
    if (deploymentMode === 'solo' && activeModelIndex >= 0) {
      setWheelPage(Math.floor(activeModelIndex / WHEEL_PAGE_SIZE));
    } else {
      setWheelPage((page) => Math.min(page, wheelPageCount - 1));
    }
  }, [activeModelIndex, deploymentMode, wheelPageCount]);

  const customModelCount = settings.models.filter(
    (model) => model.origin === 'user',
  ).length;
  const customAnimationCount = settings.animations.filter(
    (animation) => animation.origin === 'user',
  ).length;

  const previewType: PlayableAnimationType =
    previewAnimation?.animation_type ??
    (previewAnimation ? 'CUSTOM' : previewMouthTest ? 'TALK' : 'IDLE');
  const ambientAnimationUrls = useMemo(
    () =>
      animationUrlsForType(
        settings.animations,
        previewMouthTest ? 'TALK' : 'IDLE',
      ),
    [previewMouthTest, settings.animations],
  );
  const previewClip = previewAnimation?.clips.find(
    (clip) => clip.id === previewClipId,
  );
  const previewAnimationUrls = useMemo(
    () =>
      previewClip
        ? [previewClip.asset_url]
        : previewAnimation
          ? previewAnimation.clips.map((clip) => clip.asset_url)
          : ambientAnimationUrls,
    [ambientAnimationUrls, previewAnimation, previewClip],
  );
  const previewProceduralPreset =
    previewAnimation?.procedural_preset ??
    proceduralPresetForType(
      settings.animations,
      previewMouthTest ? 'TALK' : 'IDLE',
    );

  const previewTitle = useMemo(() => {
    if (previewClip) return previewClip.animation_name;
    if (previewAnimation) return previewAnimation.animation_name;
    return 'Character preview';
  }, [previewAnimation, previewClip]);
  const professionalAnimations = useMemo(
    () =>
      settings.animations.filter(
        (animation) => animation.system || animation.clips.length > 0,
      ),
    [settings.animations],
  );
  const visibleAnimations = useMemo(
    () =>
      actionFilter === 'all'
        ? professionalAnimations
        : actionFilter === 'captured'
          ? professionalAnimations.filter(
              (animation) => animation.clips.length > 0,
            )
          : professionalAnimations.filter(
              (animation) => actionCategory(animation) === actionFilter,
            ),
    [actionFilter, professionalAnimations],
  );
  const actionCategoryCounts = useMemo(
    () =>
      Object.fromEntries(
        ACTION_CATEGORIES.map(({ id }) => [
          id,
          id === 'all'
            ? professionalAnimations.length
            : id === 'captured'
                ? professionalAnimations.filter(
                    (animation) => animation.clips.length > 0,
                  ).length
                : professionalAnimations.filter(
                    (animation) => actionCategory(animation) === id,
                  ).length,
        ]),
      ) as Record<ActionCategory, number>,
    [professionalAnimations],
  );

  const updateSnapshot = useCallback((snapshot: PersonaSettingsSnapshot) => {
    setSettings(snapshot);
    return snapshot;
  }, []);

  const run = useCallback(
    async (
      operation: () => Promise<PersonaSettingsSnapshot | null>,
      success: string,
    ) => {
      setBusy(true);
      setNotice(null);
      try {
        const snapshot = await operation();
        if (snapshot) {
          updateSnapshot(snapshot);
          setNotice(success);
        }
        return snapshot;
      } catch (error) {
        setNotice(errorMessage(error));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [updateSnapshot],
  );

  const refreshMcpStatus = useCallback(async () => {
    setMcpLoading(true);
    try {
      if (!bridge) {
        setMcpStatus(null);
        return;
      }
      setMcpStatus(await bridge.getMcpStatus());
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setMcpLoading(false);
    }
  }, [bridge]);

  useEffect(() => {
    if (section !== 'mcp') return;
    void refreshMcpStatus();
  }, [refreshMcpStatus, section, settings.animations]);

  const copyText = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch {
      setNotice(`Unable to copy ${label.toLowerCase()}.`);
    }
  }, []);

  const openConfirmation = useCallback((request: ConfirmationRequest) => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setConfirmation(request);
  }, []);

  const closeConfirmation = useCallback(() => {
    const previousFocus = previousFocusRef.current;
    setConfirmation(null);
    setConfirming(false);
    window.requestAnimationFrame(() => {
      if (
        previousFocus?.isConnected &&
        !previousFocus.matches(':disabled')
      ) {
        previousFocus.focus();
      } else {
        settingsContentRef.current?.focus();
      }
    });
  }, []);

  useEffect(() => {
    if (!confirmation) return;
    const frame = window.requestAnimationFrame(() =>
      confirmationCancelRef.current?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [confirmation]);

  const confirmPendingAction = async () => {
    if (!confirmation || confirming) return;
    setConfirming(true);
    try {
      await confirmation.onConfirm();
    } finally {
      closeConfirmation();
    }
  };

  const importModel = async () => {
    if (!bridge) return;
    const existingModelIds = new Set(settings.models.map((model) => model.id));
    const snapshot = await run(
      () => bridge.importModel({ model_name: modelName }),
      'Model added to your library.',
    );
    if (!snapshot) return;
    const imported = snapshot.models.find(
      (model) => !existingModelIds.has(model.id),
    );
    if (imported) setSelectedModelId(imported.id);
    setModelName('');
  };

  const createAnimation = async () => {
    if (!bridge) return;
    const snapshot = await run(
      () => bridge.createAnimation(animationMetadata),
      'Animation action created. Add one or more VRMA clips to make it playable.',
    );
    if (!snapshot) return;
    setAnimationMetadata({
      animation_name: '',
      animation_description: '',
      animation_trigger_scenario: '',
    });
  };

  const addAnimationClips = async (animation: PersonaAnimationSettings) => {
    if (!bridge) return;
    const snapshot = await run(
      () => bridge.addAnimationClips(animation.id),
      `VRMA clips added to ${animation.animation_name}.`,
    );
    if (!snapshot) return;
    const updated = snapshot.animations.find(
      (candidate) => candidate.id === animation.id,
    );
    if (previewAnimation?.id === animation.id) {
      setPreviewAnimation(updated ?? null);
    }
  };

  const setDefaultModel = async (modelId: string) => {
    if (!bridge) return;
    const snapshot = await run(
      () => bridge.setDefaultModel(modelId),
      'Default model updated.',
    );
    if (snapshot) setSelectedModelId(modelId);
  };

  const deployModel = async (modelId: string) => {
    if (!bridge) {
      setNotice('Persona bridge unavailable — restart the app and try Deploy again.');
      return;
    }
    const snapshot = await run(
      () => bridge.deployModel(modelId),
      'Character deployed and opened on your desktop.',
    );
    if (!snapshot) return;
    crewSelectionDirty.current = false;
    setSelectedModelId(modelId);
    setDeploymentMode('solo');
    setCrewModelIds([modelId]);
  };

  const deploySelection = async () => {
    if (!bridge) {
      setNotice('Persona bridge unavailable — restart the app and try Deploy again.');
      return;
    }
    if (deploymentMode === 'crew') {
      const modelIds =
        crewModelIds.length > 0
          ? crewModelIds
          : selectedModel
            ? [selectedModel.id]
            : [];
      if (modelIds.length === 0) {
        setNotice('Select at least one character for the crew.');
        return;
      }
      const snapshot = await run(
        () => bridge.deployModels(modelIds),
        modelIds.length > 1
          ? `Crew of ${modelIds.length} deployed and opened on your desktop.`
          : 'Character deployed and opened on your desktop.',
      );
      if (!snapshot) return;
      crewSelectionDirty.current = false;
      setSelectedModelId(snapshot.default_model_id);
      setDeploymentMode(snapshot.deployment_mode);
      setCrewModelIds(snapshot.deployed_model_ids);
      return;
    }
    if (!selectedModel) {
      setNotice('Select a character on the wheel, then Deploy.');
      return;
    }
    await deployModel(selectedModel.id);
  };

  const chooseModel = (modelId: string) => {
    setSelectedModelId(modelId);
    if (deploymentMode === 'crew') {
      crewSelectionDirty.current = true;
      setCrewModelIds((current) => {
        const next = toggleCrewMember(current, modelId);
        return next.length > 0 ? next : [modelId];
      });
      return;
    }
    setCrewModelIds([modelId]);
    if (modelId !== settings.default_model_id) {
      void setDefaultModel(modelId);
    }
  };

  const switchDeploymentMode = (mode: 'solo' | 'crew') => {
    crewSelectionDirty.current = true;
    setDeploymentMode(mode);
    if (mode === 'solo') {
      const leader =
        selectedModelId ??
        crewModelIds[0] ??
        settings.default_model_id ??
        settings.models[0]?.id ??
        null;
      setCrewModelIds(leader ? [leader] : []);
      if (leader) setSelectedModelId(leader);
      return;
    }
    if (crewModelIds.length === 0 && selectedModelId) {
      setCrewModelIds([selectedModelId]);
    }
  };

  const pickRandomCrew = () => {
    if (settings.models.length === 0) return;
    crewSelectionDirty.current = true;
    setDeploymentMode('crew');
    const next = randomCrew(
      settings.models.map((model) => model.id),
      Math.min(MAX_CREW_SIZE, settings.models.length),
    );
    setCrewModelIds(next);
    if (next[0]) setSelectedModelId(next[0]);
  };

  const connectToCodexCli = async () => {
    if (!bridge) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await bridge.connectCodexCli();
      setCliConnected(true);
      setNotice(
        `Codex CLI connected in ${result.config_path}. Start a new Codex session to load Persona.`,
      );
    } catch (error) {
      setCliConnected(false);
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const deleteModel = (model: PersonaModelSettings) => {
    if (!bridge || !model.removable) return;
    openConfirmation({
      confirmLabel: 'Delete',
      title: `Delete “${model.model_name}”?`,
      detail: 'The model and its locally stored VRM file will be removed.',
      onConfirm: async () => {
        const snapshot = await run(
          () => bridge.deleteModel(model.id),
          'Model deleted from your library.',
        );
        if (snapshot && selectedModelId === model.id) {
          setSelectedModelId(snapshot.default_model_id);
        }
      },
    });
  };

  const beginEditingAnimation = (animation: PersonaAnimationSettings) => {
    if (!animation.editable) return;
    setEditingAnimationId(animation.id);
    setEditingAnimationMetadata({
      animation_name: animation.animation_name,
      animation_description: animation.animation_description,
      animation_trigger_scenario: animation.animation_trigger_scenario,
    });
  };

  const saveAnimation = async () => {
    if (!bridge || !editingAnimationId) return;
    const snapshot = await run(
      () =>
        bridge.updateAnimation(
          editingAnimationId,
          editingAnimationMetadata,
        ),
      'Animation details updated.',
    );
    if (!snapshot) return;
    const updated = snapshot.animations.find(
      (animation) => animation.id === editingAnimationId,
    );
    if (previewAnimation?.id === editingAnimationId) {
      setPreviewAnimation(updated ?? null);
    }
    setEditingAnimationId(null);
  };

  const deleteAnimation = (animation: PersonaAnimationSettings) => {
    if (!bridge || !animation.removable) return;
    openConfirmation({
      confirmLabel: 'Delete',
      title: `Delete “${animation.animation_name}”?`,
      detail:
        animation.origin === 'packaged'
          ? 'The action will be removed from your active library. Reset packaged actions can restore it.'
          : 'The action and all of its locally stored VRMA clips will be removed.',
      onConfirm: async () => {
        const snapshot = await run(
          () => bridge.deleteAnimation(animation.id),
          'Animation action removed from your active library.',
        );
        if (!snapshot) return;
        if (previewAnimation?.id === animation.id) {
          setPreviewAnimation(null);
          setPreviewClipId(null);
        }
        if (editingAnimationId === animation.id) {
          setEditingAnimationId(null);
        }
      },
    });
  };

  const deleteAnimationClip = (
    animation: PersonaAnimationSettings,
    clip: PersonaAnimationClipSettings,
  ) => {
    if (!bridge || !clip.removable) return;
    openConfirmation({
      confirmLabel: 'Delete',
      title: `Delete “${clip.animation_name}”?`,
      detail: 'The locally stored VRMA clip will be removed.',
      onConfirm: async () => {
        const snapshot = await run(
          () => bridge.deleteAnimationClip(animation.id, clip.id),
          `${clip.animation_name} removed.`,
        );
        if (!snapshot) return;
        const updated = snapshot.animations.find(
          (candidate) => candidate.id === animation.id,
        );
        if (previewAnimation?.id === animation.id) {
          setPreviewAnimation(updated ?? null);
        }
        if (previewClipId === clip.id) {
          setPreviewClipId(null);
        }
      },
    });
  };

  const resetPackagedAnimations = () => {
    if (
      !bridge ||
      settings.packaged_animation_change_count === 0
    ) {
      return;
    }
    openConfirmation({
      confirmLabel: 'Reset',
      title: 'Reset packaged actions?',
      detail:
        'Packaged names, descriptions, triggers, and visibility will be restored. User-created actions and uploaded clips will not change.',
      onConfirm: async () => {
        const snapshot = await run(
          () => bridge.resetPackagedAnimations(),
          'Packaged animation actions restored.',
        );
        if (!snapshot) return;
        setEditingAnimationId(null);
        setPreviewAnimation(null);
        setPreviewClipId(null);
      },
    });
  };

  const previewCharacterSize = (size: number) => {
    setSettings((current) => ({ ...current, character_size: size }));
  };

  const saveCharacterSize = async (size: number) => {
    if (!bridge) return;
    await run(
      () => bridge.setCharacterSize(size),
      `Default character size set to ${Math.round(size * 100)}%.`,
    );
  };

  const playAnimationClip = (
    animation: PersonaAnimationSettings,
    clip: PersonaAnimationClipSettings,
  ) => {
    setPreviewAnimation(animation);
    setPreviewClipId(clip.id);
    setPreviewRequest((request) => request + 1);
  };

  const playProceduralAnimation = useCallback(
    (animation: PersonaAnimationSettings) => {
      if (!animation.procedural_preset && animation.clips.length === 0) return;
      setPreviewMouthTest(false);
      setPreviewAnimation(animation);
      setPreviewClipId(null);
      setPreviewRequest((request) => request + 1);
    },
    [],
  );

  const cycleCandidates = useMemo(
    () =>
      visibleAnimations.filter(
        (animation) =>
          animation.procedural_preset != null || animation.clips.length > 0,
      ).sort(
        (left, right) =>
          Number(right.clips.length > 0) - Number(left.clips.length > 0),
      ),
    [visibleAnimations],
  );

  useEffect(() => {
    if (!cycleActions || cycleCandidates.length === 0) return;
    const timer = window.setInterval(() => {
      setCycleIndex((current) => {
        const next = (current + 1) % cycleCandidates.length;
        playProceduralAnimation(cycleCandidates[next]);
        return next;
      });
    }, 9500);
    return () => window.clearInterval(timer);
  }, [cycleActions, cycleCandidates, playProceduralAnimation]);

  useEffect(() => {
    if (!previewMouthTest) return;
    const timer = window.setTimeout(() => setPreviewMouthTest(false), 6000);
    return () => window.clearTimeout(timer);
  }, [previewMouthTest]);

  const toggleActionCycle = () => {
    if (cycleActions) {
      setCycleActions(false);
      return;
    }
    const first = cycleCandidates[0];
    if (!first) return;
    setCycleIndex(0);
    setCycleActions(true);
    playProceduralAnimation(first);
  };

  const stepActionCycle = (direction: -1 | 1) => {
    if (cycleCandidates.length === 0) return;
    const next =
      (cycleIndex + direction + cycleCandidates.length) %
      cycleCandidates.length;
    setCycleIndex(next);
    playProceduralAnimation(cycleCandidates[next]);
  };

  const headingSummary =
    section === 'mcp'
      ? mcpStatus
        ? `${mcpStatus.tools.length} tools · ${mcpStatus.playable_actions.length} playable actions`
        : 'Local agent connection'
      : section === 'models'
        ? `${settings.models.length} characters · ${customModelCount} custom`
        : `${customModelCount} custom models · ${customAnimationCount} custom actions`;
  const mcpHealth = mcpStatus?.health ?? (mcpLoading ? 'starting' : 'unavailable');
  const mcpServerUrl =
    mcpStatus?.server_url ?? 'http://127.0.0.1:47831/mcp';
  const mcpSetupCommand =
    mcpStatus?.setup_command ??
    `codex mcp add persona --url ${mcpServerUrl}`;

  return (
    <main
      className={`settings-app ${
        previewCollapsed ? 'preview-collapsed' : ''
      }`}
    >
      <aside className="settings-sidebar">
        <div className="settings-brand">
          <img src="./assets/persona-icon.png" alt="" />
          <div className="settings-brand-copy">
            <strong>Persona</strong>
            <span>Settings</span>
          </div>
        </div>

        <nav aria-label="Settings sections">
          {SECTIONS.map((item) => (
            <button
              className={section === item.id ? 'active' : ''}
              data-testid={`section-${item.id}`}
              key={item.id}
              onClick={() => setSection(item.id)}
              type="button"
              title={item.label}
            >
              <span className="nav-glyph" aria-hidden="true">
                {SECTION_ICONS[item.id]}
              </span>
              <span className="settings-nav-copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="settings-sidebar-status">
          <span className="status-dot" />
          <span className="settings-status-copy">Changes save automatically</span>
        </div>
      </aside>

      <section
        className="settings-content"
        ref={settingsContentRef}
        tabIndex={-1}
      >
        <header className="settings-heading">
          <div>
            <span className="eyebrow">
              {section === 'mcp'
                ? 'Local integration'
                : 'Character configuration'}
            </span>
            <h1>{SECTIONS.find((item) => item.id === section)?.label}</h1>
          </div>
          <span className="library-count">{headingSummary}</span>
        </header>

        {notice && (
          <div className="settings-notice" role="status">
            <span>{notice}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice(null)}
              type="button"
            >
              ×
            </button>
          </div>
        )}

        <div className="settings-scroll">
          {section === 'models' && (
            <>
              <section className="settings-panel character-wheel-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Character wheel</h2>
                    <p>
                      {deploymentMode === 'crew'
                        ? `Toggle up to ${MAX_CREW_SIZE} characters. First pick leads the crew.`
                        : 'Choose a character, then deploy it to your desktop.'}
                    </p>
                  </div>
                  <div className="wheel-toolbar">
                    <button
                      aria-label="Previous character wheel"
                      disabled={wheelPageCount <= 1}
                      onClick={() =>
                        setWheelPage(
                          (page) =>
                            (page - 1 + wheelPageCount) % wheelPageCount,
                        )
                      }
                      type="button"
                    >
                      ‹
                    </button>
                    <span className="wheel-count">
                      {settings.models.length} characters · {wheelPage + 1}/
                      {wheelPageCount}
                    </span>
                    <button
                      aria-label="Next character wheel"
                      disabled={wheelPageCount <= 1}
                      onClick={() =>
                        setWheelPage(
                          (page) => (page + 1) % wheelPageCount,
                        )
                      }
                      type="button"
                    >
                      ›
                    </button>
                  </div>
                </div>
                <div className="deployment-mode-bar" role="group" aria-label="Deployment mode">
                  <button
                    className={deploymentMode === 'solo' ? 'active' : ''}
                    onClick={() => switchDeploymentMode('solo')}
                    type="button"
                  >
                    Solo
                  </button>
                  <button
                    className={deploymentMode === 'crew' ? 'active' : ''}
                    onClick={() => switchDeploymentMode('crew')}
                    type="button"
                  >
                    Crew
                  </button>
                  <button
                    disabled={settings.models.length === 0}
                    onClick={pickRandomCrew}
                    type="button"
                  >
                    Random crew
                  </button>
                  <span className="wheel-count">
                    {deploymentMode === 'crew'
                      ? `${crewModelIds.length}/${MAX_CREW_SIZE} selected`
                      : '1 character'}
                  </span>
                </div>
                {settings.models.length === 0 ? (
                  <div className="empty-library">
                    <strong>Your wheel is empty</strong>
                    <p>Add a VRM model below to create your first character.</p>
                  </div>
                ) : (
                  <div
                    aria-label="Character selection wheel"
                    className="model-wheel"
                    role="group"
                  >
                    <div className="model-wheel-rings" aria-hidden="true" />
                    {wheelModels.map((model, index) => {
                      const angle = (index / wheelModels.length) * 360;
                      const crewIndex = crewModelIds.indexOf(model.id);
                      const isDeployed =
                        settings.deployment_mode === 'crew'
                          ? settings.deployed_model_ids.includes(model.id)
                          : model.id === settings.default_model_id;
                      const isSelected =
                        deploymentMode === 'crew'
                          ? crewIndex >= 0
                          : model.id === selectedModel?.id;
                      return (
                        <button
                          aria-label={
                            deploymentMode === 'crew'
                              ? crewIndex >= 0
                                ? `Remove ${model.model_name} from crew`
                                : `Add ${model.model_name} to crew`
                              : `Choose ${model.model_name}`
                          }
                          aria-pressed={isSelected}
                          className={`model-wheel-item ${
                            isDeployed ? 'active' : ''
                          } ${isSelected ? 'selected' : ''}`}
                          disabled={busy || !bridge}
                          key={model.id}
                          onClick={() => chooseModel(model.id)}
                          style={
                            {
                              '--wheel-transform': `translate(-50%, -50%) rotate(${angle}deg) translateY(-154px) rotate(${-angle}deg)`,
                            } as CSSProperties
                          }
                          title={model.model_name}
                          type="button"
                        >
                          {crewIndex >= 0 && deploymentMode === 'crew' && (
                            <span className="model-wheel-rank" aria-hidden="true">
                              {crewIndex + 1}
                            </span>
                          )}
                          <span className="model-wheel-avatar" aria-hidden="true">
                            {modelInitials(model.model_name)}
                          </span>
                          <span className="model-wheel-name">
                            {model.model_name}
                          </span>
                        </button>
                      );
                    })}
                    <div className="model-wheel-core" aria-live="polite">
                      <img src="./assets/persona-icon.png" alt="" />
                      <small>
                        {deploymentMode === 'crew'
                          ? 'Crew selection'
                          : 'Active character'}
                      </small>
                      <strong>
                        {deploymentMode === 'crew'
                          ? crewModels.length > 0
                            ? crewModels
                                .map((model) => model.model_name)
                                .join(' · ')
                            : 'Pick up to 4'
                          : settings.models.find(
                              (model) => model.id === settings.default_model_id,
                            )?.model_name ?? 'Choose one'}
                      </strong>
                    </div>
                  </div>
                )}
              </section>

              <section className="settings-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Model library</h2>
                    <p>Select a model to inspect it in the preview.</p>
                  </div>
                </div>
                <div className="asset-grid">
                  {settings.models.length === 0 && (
                    <div className="empty-library">
                      <strong>No model configured</strong>
                      <p>
                        Add a VRM file below. Persona stays inactive until a
                        model is available and selected as the default.
                      </p>
                    </div>
                  )}
                  {settings.models.map((model) => {
                    const selected =
                      deploymentMode === 'crew'
                        ? crewModelIds.includes(model.id)
                        : model.id === selectedModel?.id;
                    const isDefault = model.id === settings.default_model_id;
                    const crewIndex = crewModelIds.indexOf(model.id);
                    return (
                      <article
                        className={`asset-card ${selected ? 'selected' : ''}`}
                        key={model.id}
                      >
                        <button
                          className="asset-card-main"
                          onClick={() => chooseModel(model.id)}
                          type="button"
                        >
                          <span className="asset-icon">
                            {deploymentMode === 'crew' && crewIndex >= 0
                              ? crewIndex + 1
                              : 'VRM'}
                          </span>
                          <span>
                            <strong>{model.model_name}</strong>
                            <small>
                              {model.origin === 'packaged'
                                ? 'Packaged model'
                                : 'User model'}
                            </small>
                          </span>
                        </button>
                        <div className="asset-card-footer">
                          {isDefault ? (
                            <span className="default-badge">
                              {settings.deployment_mode === 'crew'
                                ? 'Leader'
                                : 'Default'}
                            </span>
                          ) : (
                            <button
                              disabled={busy || !bridge}
                              onClick={() => void setDefaultModel(model.id)}
                              type="button"
                            >
                              Make default
                            </button>
                          )}
                          <div className="asset-card-actions">
                            <button
                              onClick={() => {
                                if (deploymentMode === 'crew') {
                                  setSelectedModelId(model.id);
                                  if (!crewModelIds.includes(model.id)) {
                                    chooseModel(model.id);
                                  }
                                } else {
                                  setSelectedModelId(model.id);
                                }
                              }}
                              type="button"
                            >
                              Preview
                            </button>
                            {model.removable && (
                              <button
                                className="danger-text-button"
                                disabled={busy || !bridge}
                                onClick={() => void deleteModel(model)}
                                type="button"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="settings-panel import-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Add a custom model</h2>
                    <p>Persona copies the selected VRM into your local library.</p>
                  </div>
                  <span className="file-pill">.vrm</span>
                </div>
                <label>
                  Model name <code>model_name</code>
                  <input
                    maxLength={80}
                    onChange={(event) => setModelName(event.target.value)}
                    placeholder="e.g. Studio Assistant"
                    value={modelName}
                  />
                </label>
                <button
                  className="primary-button"
                  disabled={busy || !bridge || !modelName.trim()}
                  onClick={() => void importModel()}
                  type="button"
                >
                  Choose VRM file
                </button>
                {!bridge && (
                  <p className="desktop-note">
                    File import is available in the Persona desktop app.
                  </p>
                )}
              </section>
            </>
          )}

          {section === 'animations' && (
            <>
              <section className="settings-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Animation actions</h2>
                    <p>
                      Captured VRMA motion plays first. Generated motion stays
                      available as a fallback for actions without a clip.
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    disabled={
                      busy ||
                      !bridge ||
                      settings.packaged_animation_change_count === 0
                    }
                    onClick={() => void resetPackagedAnimations()}
                    type="button"
                  >
                    Reset packaged actions
                  </button>
                </div>
                <div className="action-dashboard">
                  <div
                    aria-label="Action categories"
                    className="action-category-tabs"
                    role="tablist"
                  >
                    {ACTION_CATEGORIES.map((category) => (
                      <button
                        aria-selected={actionFilter === category.id}
                        className={
                          actionFilter === category.id ? 'selected' : ''
                        }
                        key={category.id}
                        onClick={() => {
                          setActionFilter(category.id);
                          setCycleActions(false);
                          setCycleIndex(0);
                        }}
                        role="tab"
                        type="button"
                      >
                        {category.label}
                        <span>{actionCategoryCounts[category.id]}</span>
                      </button>
                    ))}
                  </div>
                  <div className="action-cycle-controls">
                    <div>
                      <strong>Live action cycle</strong>
                      <span>
                        {cycleActions
                          ? `Playing ${cycleCandidates[cycleIndex]?.animation_name ?? 'action'}`
                          : `Review ${cycleCandidates.length} ${actionFilter} actions`}
                      </span>
                    </div>
                    <button
                      aria-label="Previous action"
                      disabled={cycleCandidates.length === 0}
                      onClick={() => stepActionCycle(-1)}
                      type="button"
                    >
                      ‹
                    </button>
                    <button
                      className={cycleActions ? 'cycling' : ''}
                      disabled={cycleCandidates.length === 0}
                      onClick={toggleActionCycle}
                      type="button"
                    >
                      {cycleActions ? '■ Stop cycle' : '▶ Cycle actions'}
                    </button>
                    <button
                      aria-label="Next action"
                      disabled={cycleCandidates.length === 0}
                      onClick={() => stepActionCycle(1)}
                      type="button"
                    >
                      ›
                    </button>
                  </div>
                </div>
                <div className="animation-list">
                  {visibleAnimations.map((animation) => (
                    <article
                      className={`animation-card ${
                        animation.system ? 'system-action-card' : ''
                      }`}
                      key={animation.id}
                    >
                      <div className="animation-card-header">
                        <div className="animation-card-copy">
                          <div>
                            <strong>
                              {animation.system
                                ? animation.animation_type === 'IDLE'
                                  ? 'Idle'
                                  : 'Speaking'
                                : animation.animation_name}
                            </strong>
                            <span>
                              {animation.system
                                ? 'System action'
                                : animation.origin === 'packaged'
                                  ? animation.modified
                                    ? 'Packaged · modified'
                                    : 'Packaged'
                                  : 'Custom action'}
                            </span>
                          </div>
                          <p>{animation.animation_description}</p>
                          <small>
                            <b>Trigger:</b>{' '}
                            {animation.animation_trigger_scenario}
                          </small>
                        </div>
                        <div className="animation-card-actions">
                          {animation.editable && (
                            <button
                              disabled={busy || !bridge}
                              onClick={() => beginEditingAnimation(animation)}
                              type="button"
                            >
                              Edit
                            </button>
                          )}
                          {animation.removable && (
                            <button
                              className="danger-text-button"
                              disabled={busy || !bridge}
                              onClick={() => void deleteAnimation(animation)}
                              type="button"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="animation-clips">
                        {(animation.procedural_preset ||
                          animation.clips.length > 0) && (
                          <button
                            className={`procedural-preview-button ${
                              previewAnimation?.id === animation.id &&
                              previewClipId == null
                                ? 'playing'
                                : ''
                            }`}
                            onClick={() => playProceduralAnimation(animation)}
                            type="button"
                          >
                            <span aria-hidden="true">▶</span>
                            <span>
                              <strong>Preview action</strong>
                              <small>
                                {animation.clips.length > 0
                                  ? `${animation.clips.length} captured clip${
                                      animation.clips.length === 1 ? '' : 's'
                                    }`
                                  : animation.procedural_preset}
                              </small>
                            </span>
                          </button>
                        )}
                        <div className="animation-clips-heading">
                          <div>
                            <strong>VRMA clips</strong>
                            <span>
                              {animation.clips.length === 0
                                ? 'No clips added'
                                : `${animation.clips.length} ${
                                    animation.clips.length === 1
                                      ? 'clip'
                                      : 'clips'
                                  }`}
                            </span>
                          </div>
                          <button
                            className="secondary-button add-clips-button"
                            disabled={busy || !bridge}
                            onClick={() => void addAnimationClips(animation)}
                            type="button"
                          >
                            + Add VRMA files
                          </button>
                        </div>
                        {animation.clips.length === 0 ? (
                          <p className="empty-clips">
                            {animation.procedural_preset
                              ? 'Built-in motion is ready for preview, desktop commands, and MCP. Add VRMA files only if you want alternate clips.'
                              : 'Upload one or more clips to make this custom action available to MCP.'}
                          </p>
                        ) : (
                          <div className="clip-list">
                            {animation.clips.map((clip) => (
                              <div
                                aria-label={`Preview ${clip.animation_name}`}
                                className={`clip-chip ${
                                  previewClipId === clip.id ? 'playing' : ''
                                }`}
                                key={clip.id}
                                onClick={(event) => {
                                  if (
                                    (event.target as Element).closest('button')
                                  ) {
                                    return;
                                  }
                                  playAnimationClip(animation, clip);
                                }}
                                onKeyDown={(event) => {
                                  if (
                                    event.target !== event.currentTarget ||
                                    (event.key !== 'Enter' && event.key !== ' ')
                                  ) {
                                    return;
                                  }
                                  event.preventDefault();
                                  playAnimationClip(animation, clip);
                                }}
                                tabIndex={0}
                                title={`Preview ${clip.animation_name}`}
                              >
                                <span className="clip-file-icon">VRMA</span>
                                <strong>{clip.animation_name}</strong>
                                <small>
                                  {clip.origin === 'packaged'
                                    ? 'Packaged'
                                    : 'Uploaded'}
                                </small>
                                {clip.removable && (
                                  <button
                                    aria-label={`Delete ${clip.animation_name}`}
                                    className="clip-delete"
                                    disabled={busy || !bridge}
                                    onClick={() =>
                                      void deleteAnimationClip(animation, clip)
                                    }
                                    title={`Delete ${clip.animation_name}`}
                                    type="button"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              {editingAnimationId && (
                <section className="settings-panel import-panel edit-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Edit action details</h2>
                      <p>
                        These details describe the action to the Persona MCP
                        tool. Clips remain grouped under the action if its name
                        changes.
                      </p>
                    </div>
                  </div>
                  <div className="form-stack">
                    <label>
                      Action name <code>animation_name</code>
                      <input
                        maxLength={48}
                        onChange={(event) =>
                          setEditingAnimationMetadata((current) => ({
                            ...current,
                            animation_name: event.target.value,
                          }))
                        }
                        value={editingAnimationMetadata.animation_name}
                      />
                    </label>
                    <label>
                      Description <code>animation_description</code>
                      <textarea
                        maxLength={240}
                        onChange={(event) =>
                          setEditingAnimationMetadata((current) => ({
                            ...current,
                            animation_description: event.target.value,
                          }))
                        }
                        rows={3}
                        value={
                          editingAnimationMetadata.animation_description
                        }
                      />
                    </label>
                    <label>
                      Trigger scenario{' '}
                      <code>animation_trigger_scenario</code>
                      <textarea
                        maxLength={240}
                        onChange={(event) =>
                          setEditingAnimationMetadata((current) => ({
                            ...current,
                            animation_trigger_scenario: event.target.value,
                          }))
                        }
                        rows={3}
                        value={
                          editingAnimationMetadata.animation_trigger_scenario
                        }
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button
                      className="primary-button"
                      disabled={
                        busy ||
                        !editingAnimationMetadata.animation_name.trim() ||
                        !editingAnimationMetadata.animation_description.trim() ||
                        !editingAnimationMetadata.animation_trigger_scenario.trim()
                      }
                      onClick={() => void saveAnimation()}
                      type="button"
                    >
                      Save changes
                    </button>
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => setEditingAnimationId(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </section>
              )}

              <section className="settings-panel import-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Create a custom action</h2>
                    <p>
                      Create the MCP-visible action first, then add any number
                      of VRMA clips from its card above.
                    </p>
                  </div>
                  <span className="file-pill">Action</span>
                </div>
                <div className="form-stack">
                  <label>
                    Action name <code>animation_name</code>
                    <input
                      maxLength={48}
                      onChange={(event) =>
                        setAnimationMetadata((current) => ({
                          ...current,
                          animation_name: event.target.value,
                        }))
                      }
                      placeholder="e.g. wave-hello"
                      value={animationMetadata.animation_name}
                    />
                    <small>
                      Lowercase letters, numbers, and hyphens. Clips added to
                      this action are named automatically, such as wave-hello1
                      and wave-hello2.
                    </small>
                  </label>
                  <label>
                    Description <code>animation_description</code>
                    <textarea
                      maxLength={240}
                      onChange={(event) =>
                        setAnimationMetadata((current) => ({
                          ...current,
                          animation_description: event.target.value,
                        }))
                      }
                      placeholder="Describe what the movement looks and feels like."
                      rows={3}
                      value={animationMetadata.animation_description}
                    />
                  </label>
                  <label>
                    Trigger scenario <code>animation_trigger_scenario</code>
                    <textarea
                      maxLength={240}
                      onChange={(event) =>
                        setAnimationMetadata((current) => ({
                          ...current,
                          animation_trigger_scenario: event.target.value,
                        }))
                      }
                      placeholder="Explain when an agent should choose this action."
                      rows={3}
                      value={animationMetadata.animation_trigger_scenario}
                    />
                  </label>
                </div>
                <button
                  className="primary-button"
                  disabled={
                    busy ||
                    !bridge ||
                    !animationMetadata.animation_name.trim() ||
                    !animationMetadata.animation_description.trim() ||
                    !animationMetadata.animation_trigger_scenario.trim()
                  }
                  onClick={() => void createAnimation()}
                  type="button"
                >
                  Create action
                </button>
              </section>
            </>
          )}

          {section === 'appearance' && (
            <>
              <section className="settings-panel theme-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Theme</h2>
                    <p>
                      Sets how this settings window looks. The character overlay
                      stays transparent in every theme.
                    </p>
                  </div>
                </div>
                <div
                  aria-label="Theme"
                  className="theme-segmented"
                  role="group"
                >
                  {THEME_OPTIONS.map((option) => (
                    <button
                      aria-pressed={themePreference === option.id}
                      data-testid={`theme-${option.id}`}
                      key={option.id}
                      onClick={() => chooseTheme(option.id)}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="theme-swatch"
                        data-theme-preview={option.id}
                      />
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="theme-note">
                  System follows your desktop appearance and updates when it
                  changes.
                </p>
              </section>

              <section className="settings-panel appearance-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Default character size</h2>
                    <p>
                      Set how large Persona appears when a model is first framed.
                      You can still zoom and pan the live avatar manually.
                    </p>
                  </div>
                  <strong className="size-value">
                    {Math.round(settings.character_size * 100)}%
                  </strong>
                </div>
                <input
                  aria-label="Default character size"
                  className="size-slider"
                  max="1.6"
                  min="0.7"
                  onBlur={(event) =>
                    void saveCharacterSize(Number(event.currentTarget.value))
                  }
                  onChange={(event) =>
                    previewCharacterSize(Number(event.currentTarget.value))
                  }
                  onKeyUp={(event) => {
                    if (event.key.startsWith('Arrow')) {
                      void saveCharacterSize(
                        Number(event.currentTarget.value),
                      );
                    }
                  }}
                  onPointerUp={(event) =>
                    void saveCharacterSize(Number(event.currentTarget.value))
                  }
                  step="0.05"
                  type="range"
                  value={settings.character_size}
                />
                <div className="slider-labels">
                  <span>70%</span>
                  <span>Default</span>
                  <span>160%</span>
                </div>
              </section>
            </>
          )}

          {section === 'mcp' && (
            <>
              <section className="settings-panel mcp-overview-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Local MCP server</h2>
                    <p>
                      Connect compatible agents to Persona&apos;s character
                      controls and configured animation actions.
                    </p>
                  </div>
                  <span className={`mcp-health-badge ${mcpHealth}`}>
                    <i aria-hidden="true" />
                    {mcpHealth === 'online'
                      ? 'Online'
                      : mcpHealth === 'starting'
                        ? 'Starting'
                        : 'Unavailable'}
                  </span>
                </div>

                <div className="mcp-status-grid">
                  <article>
                    <span>Health</span>
                    <strong>
                      {mcpHealth === 'online'
                        ? 'Ready'
                        : mcpHealth === 'starting'
                          ? 'Starting'
                          : 'Not running'}
                    </strong>
                    <small>
                      {mcpStatus?.checked_at
                        ? `Checked ${new Date(
                            mcpStatus.checked_at,
                          ).toLocaleTimeString()}`
                        : 'Waiting for the desktop bridge'}
                    </small>
                  </article>
                  <article>
                    <span>Transport</span>
                    <strong>{mcpStatus?.transport ?? 'Streamable HTTP'}</strong>
                    <small>Model Context Protocol</small>
                  </article>
                  <article>
                    <span>Access</span>
                    <strong>
                      {mcpStatus?.local_only === false
                        ? 'Network'
                        : 'Local only'}
                    </strong>
                    <small>Bound to 127.0.0.1</small>
                  </article>
                  <article>
                    <span>Persona</span>
                    <strong>v{mcpStatus?.version ?? '—'}</strong>
                    <small>Server version</small>
                  </article>
                </div>

                {mcpStatus?.error && (
                  <p className="mcp-error-message" role="alert">
                    {mcpStatus.error}
                  </p>
                )}
              </section>

              <section className="settings-panel mcp-endpoint-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Server endpoint</h2>
                    <p>
                      Persona serves this endpoint while the desktop app is
                      open.
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    disabled={mcpLoading}
                    onClick={() => void refreshMcpStatus()}
                    type="button"
                  >
                    {mcpLoading ? 'Checking…' : 'Check health'}
                  </button>
                </div>

                <div className="mcp-copy-field">
                  <div>
                    <span>Server URL</span>
                    <code>{mcpServerUrl}</code>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => void copyText(mcpServerUrl, 'Server URL')}
                    type="button"
                  >
                    Copy
                  </button>
                </div>

                <div className="mcp-copy-field">
                  <div>
                    <span>Codex setup command</span>
                    <code>{mcpSetupCommand}</code>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      void copyText(mcpSetupCommand, 'Setup command')
                    }
                    type="button"
                  >
                    Copy
                  </button>
                </div>

                <p className="desktop-note">
                  To use a different port, set{' '}
                  <code>PERSONA_BRIDGE_PORT</code> before launching Persona and
                  register the displayed URL.
                </p>
              </section>

              <section className="settings-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Available tools</h2>
                    <p>
                      Tools are exposed without filesystem, transcript, or raw
                      audio access.
                    </p>
                  </div>
                  <span className="file-pill">
                    {mcpStatus?.tools.length ?? 4} tools
                  </span>
                </div>
                <div className="mcp-tool-list">
                  {(mcpStatus?.tools ?? Object.keys(MCP_TOOL_DESCRIPTIONS)).map(
                    (tool) => (
                      <article key={tool}>
                        <code>{tool}</code>
                        <p>
                          {MCP_TOOL_DESCRIPTIONS[tool] ??
                            'Persona MCP tool'}
                        </p>
                      </article>
                    ),
                  )}
                </div>
              </section>

              <section className="settings-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Playable actions</h2>
                    <p>
                      Actions appear in the MCP animation tool after they have
                      built-in motion or at least one VRMA clip.
                    </p>
                  </div>
                  <span className="file-pill">
                    {mcpStatus?.playable_actions.length ?? 0} active
                  </span>
                </div>
                {mcpStatus && mcpStatus.playable_actions.length > 0 ? (
                  <div className="mcp-action-list">
                    {mcpStatus.playable_actions.map((action) => (
                      <code key={action}>{action}</code>
                    ))}
                  </div>
                ) : (
                  <div className="empty-library">
                    <strong>No playable actions detected</strong>
                    <p>
                      Add a VRMA clip to an action, then check the server again.
                    </p>
                  </div>
                )}
                <p className="mcp-session-note">
                  Start a new Codex session after registering Persona. Changes
                  to installed actions are published to connected sessions
                  automatically.
                </p>
              </section>
            </>
          )}
        </div>
      </section>

      <aside className="settings-preview">
        <button
          aria-expanded={!previewCollapsed}
          aria-label={
            previewCollapsed ? 'Expand preview pane' : 'Collapse preview pane'
          }
          className="settings-preview-toggle"
          onClick={() => setPreviewCollapsed((collapsed) => !collapsed)}
          title={previewCollapsed ? 'Expand preview' : 'Collapse preview'}
          type="button"
        >
          <span aria-hidden="true">{previewCollapsed ? '‹' : '›'}</span>
        </button>

        {!previewCollapsed && (
          <>
            <div className="preview-header">
              <div>
                <span className="eyebrow">Live preview</span>
                <strong>
                  {deploymentMode === 'crew' && previewModels.length > 1
                    ? `${previewModels.length}-character crew`
                    : selectedModel?.model_name ?? 'Persona'}
                </strong>
              </div>
              <span className="preview-live">
                <i />
                Live
              </span>
            </div>
            <div className="preview-stage" data-testid="settings-preview">
              {previewCharacters.length > 0 && (
                <Scene
                  animation={previewType}
                  animationRequest={previewRequest}
                  animationUrls={previewAnimationUrls}
                  audioLevel={previewMouthTest ? 0.14 : 0}
                  characterSize={settings.character_size}
                  enablePan={false}
                  framingMargin={1.22}
                  groundShadow
                  characters={previewCharacters}
                  onAnimationComplete={() => {
                    setPreviewAnimation(null);
                    setPreviewClipId(null);
                  }}
                  proceduralPreset={previewProceduralPreset}
                  playback={previewAnimation ? 'once' : 'loop'}
                  speaking={previewMouthTest}
                />
              )}
              <div className="preview-hint">
                Drag to rotate · Scroll to zoom
              </div>
            </div>
            <button
              className={`deploy-character-button ${
                deploymentIsActive ? 'deployed' : ''
              }`}
              disabled={
                busy ||
                !bridge ||
                (deploymentMode === 'crew'
                  ? crewModelIds.length === 0
                  : !selectedModel)
              }
              onClick={() => {
                void deploySelection();
              }}
              type="button"
            >
              <span className="deploy-character-icon" aria-hidden="true">
                {deploymentIsActive ? '✓' : '↗'}
              </span>
              <span>
                <strong>
                  {deploymentMode === 'crew' && crewModelIds.length > 1
                    ? 'Deploy crew'
                    : 'Deploy character'}
                </strong>
                <small>
                  {deploymentIsActive
                    ? deploymentMode === 'crew' && crewModelIds.length > 1
                      ? 'Open the active crew on your desktop'
                      : 'Open the active character on your desktop'
                    : deploymentMode === 'crew' && crewModelIds.length > 1
                      ? `Deploy ${crewModelIds.length} characters to Persona`
                      : `Switch Persona to ${selectedModel?.model_name ?? 'this model'}`}
                </small>
              </span>
              {deploymentIsActive && (
                <span className="deploy-character-badge">Active</span>
              )}
            </button>
            <button
              className={`connect-cli-button ${cliConnected ? 'connected' : ''}`}
              disabled={busy || !bridge || mcpStatus?.health === 'unavailable'}
              onClick={() => void connectToCodexCli()}
              type="button"
            >
              <span className="connect-cli-icon" aria-hidden="true">
                &gt;_
              </span>
              <span>
                <strong>
                  {cliConnected ? 'Connected to Codex CLI' : 'Connect to Codex CLI'}
                </strong>
                <small>
                  {cliConnected
                    ? 'Persona MCP is registered'
                    : 'Register the local Persona MCP server'}
                </small>
              </span>
            </button>
            <div className="preview-now-playing">
              <div>
                <span>Now previewing</span>
                <strong>
                  {previewMouthTest ? 'Mouth + speaking test' : previewTitle}
                </strong>
              </div>
              <button
                className={previewMouthTest ? 'active' : ''}
                onClick={() => {
                  setPreviewAnimation(null);
                  setPreviewClipId(null);
                  setPreviewMouthTest((active) => !active);
                  setPreviewRequest((request) => request + 1);
                }}
                type="button"
              >
                {previewMouthTest ? 'Stop mouth test' : 'Test mouth'}
              </button>
              {previewAnimation && (
                <small>{previewAnimation.animation_description}</small>
              )}
            </div>
          </>
        )}
      </aside>

      {confirmation && (
        <div
          className="settings-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !confirming) {
              closeConfirmation();
            }
          }}
        >
          <div
            aria-busy={confirming}
            aria-describedby="settings-confirmation-detail"
            aria-labelledby="settings-confirmation-title"
            aria-modal="true"
            className="settings-dialog"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !confirming) {
                event.preventDefault();
                closeConfirmation();
                return;
              }
              if (event.key !== 'Tab') return;
              const first = confirmationCancelRef.current;
              const last = confirmationConfirmRef.current;
              if (!first || !last) return;
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (
                !event.shiftKey &&
                document.activeElement === last
              ) {
                event.preventDefault();
                first.focus();
              }
            }}
            ref={confirmationDialogRef}
            role="dialog"
          >
            <div className="settings-dialog-icon" aria-hidden="true">
              !
            </div>
            <div className="settings-dialog-copy">
              <span className="eyebrow">Confirm change</span>
              <h2 id="settings-confirmation-title">
                {confirmation.title}
              </h2>
              <p id="settings-confirmation-detail">
                {confirmation.detail}
              </p>
            </div>
            <div className="settings-dialog-actions">
              <button
                className="secondary-button"
                disabled={confirming}
                onClick={closeConfirmation}
                ref={confirmationCancelRef}
                type="button"
              >
                Cancel
              </button>
              <button
                className="settings-dialog-confirm"
                disabled={confirming}
                onClick={() => void confirmPendingAction()}
                ref={confirmationConfirmRef}
                type="button"
              >
                {confirming ? 'Working…' : confirmation.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
