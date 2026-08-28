import { VALID_STEPS, type ActionSettings, type PressAction, type StepPercent, type VolumeMode } from "./types.js";

const DEFAULTS: ActionSettings = {
  mode: "application",
  executable: "",
  displayName: "",
  step: 2,
  pressAction: "toggleMute",
  sessionMode: "all",
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function defaultSettings(mode: VolumeMode): ActionSettings {
  return {
    ...DEFAULTS,
    mode,
    displayName: mode === "master" ? "SYSTEM" : "",
  };
}

export function settingsFromActionUuid(uuid: string): ActionSettings {
  const mode: VolumeMode = uuid.endsWith(".master") ? "master" : "application";
  return defaultSettings(mode);
}

export function normalizeSettings(
  raw: unknown,
  fallbackMode: VolumeMode = "application",
): ActionSettings {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const mode = normalizeMode(input.mode, fallbackMode);
  const step = normalizeStep(input.step);
  const sessionMode = input.sessionMode === "first" ? "first" : "all";
  const executable = asString(input.executable || input.application);
  const displayName = asString(input.displayName) || stripExe(executable);

  const settings: ActionSettings = {
    mode,
    executable: mode === "master" ? "" : executable,
    displayName: mode === "master" ? (displayName || "SYSTEM") : displayName,
    step,
    pressAction: normalizePressAction(input.pressAction),
    sessionMode,
  };

  const pid = asOptionalNumber(input.pid);
  if (pid) settings.pid = pid;
  const sessionId = asString(input.sessionId);
  if (sessionId) settings.sessionId = sessionId;
  return settings;
}

export function normalizePressAction(value: unknown): PressAction {
  if (value === "volumeUp" || value === "volumeDown" || value === "toggleMute") {
    return value;
  }
  return "toggleMute";
}

export function normalizeStep(value: unknown): StepPercent {
  const n = typeof value === "number" ? value : Number(value);
  return (VALID_STEPS as readonly number[]).includes(n) ? (n as StepPercent) : 2;
}

export function normalizeMode(value: unknown, fallback: VolumeMode): VolumeMode {
  if (value === "master" || value === "application" || value === "input" || value === "output") {
    return value;
  }
  return fallback;
}

export function stripExe(executable: string): string {
  return executable.replace(/\.exe$/i, "");
}

export function persistableSettings(settings: ActionSettings): ActionSettings {
  const copy: ActionSettings = {
    mode: settings.mode,
    executable: settings.executable,
    displayName: settings.displayName,
    step: settings.step,
    pressAction: settings.pressAction,
    sessionMode: settings.sessionMode,
  };
  if (settings.sessionId) copy.sessionId = settings.sessionId;
  return copy;
}
