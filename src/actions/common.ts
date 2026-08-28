import type { ActionSettings, AppQuery, AppVolumeState, VolumeState } from "../types.js";
import { toPercent } from "../volume.js";

export interface ActionInstance {
  context: string;
  settings: ActionSettings;
  kind: "master" | "application";
}

export function queryFromSettings(settings: ActionSettings): AppQuery {
  return {
    executable: settings.executable,
    displayName: settings.displayName,
    pid: settings.pid,
    sessionId: settings.sessionId,
    sessionMode: settings.sessionMode,
  };
}

export function displayTitle(settings: ActionSettings): string {
  if (settings.mode === "master") return settings.displayName || "SYSTEM";
  return settings.displayName || settings.executable || "APP";
}

export function viewFromMaster(state: VolumeState, settings: ActionSettings) {
  return {
    title: displayTitle(settings),
    percent: toPercent(state.volume),
    muted: state.muted,
    waiting: false,
  };
}

export function viewFromApp(state: AppVolumeState, settings: ActionSettings) {
  return {
    title: state.displayName || displayTitle(settings),
    percent: toPercent(state.volume),
    muted: state.muted,
    waiting: state.waiting,
  };
}

export function isMasterAction(uuid: string): boolean {
  return uuid.endsWith(".master");
}
