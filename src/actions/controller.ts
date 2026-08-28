import type { AudioManager } from "../audio/AudioManager.js";
import { DisplayManager } from "../ulanzi/DisplayManager.js";
import { logger } from "../logger.js";
import {
  normalizeSettings,
  persistableSettings,
  settingsFromActionUuid,
} from "../settings.js";
import type {
  ActionSettings,
  AppVolumeState,
  AudioSession,
  UlanziHost,
  UlanziMessage,
  VolumeMode,
  VolumeState,
} from "../types.js";
import {
  isMasterAction,
  queryFromSettings,
  viewFromApp,
  viewFromMaster,
  type ActionInstance,
} from "./common.js";

export class ActionController {
  private actions = new Map<string, ActionInstance>();
  private inspectors = new Set<string>();
  private renderQueue = new Map<string, Promise<void>>();
  private lastPressAt = new Map<string, number>();

  constructor(
    private readonly host: UlanziHost,
    private readonly audio: AudioManager,
    private readonly display: DisplayManager,
  ) {}

  bind(): void {
    this.audio.on("sessionsChanged", (sessions: AudioSession[]) => {
      void this.onSessionsChanged(sessions);
    });
    this.audio.on("masterChanged", (state: VolumeState) => {
      void this.onMasterChanged(state);
    });
    this.audio.on("appChanged", (state: AppVolumeState) => {
      void this.onAppChanged(state);
    });
    this.audio.on("helperStatus", (status: { connected: boolean; error?: string }) => {
      if (!status.connected) {
        for (const [context, action] of this.actions) {
          this.display.render(context, {
            title: action.kind === "master" ? "SYSTEM" : action.settings.displayName || "APP",
            percent: 0,
            muted: false,
            waiting: false,
            error: "No helper",
          });
        }
      } else {
        void this.refreshAll();
      }
      this.pushApplicationsToInspectors();
    });
  }

  upsert(context: string, raw: unknown, uuid = ""): ActionInstance {
    const fallback: VolumeMode = isMasterAction(uuid) ? "master" : "application";
    const fromUuid = uuid ? settingsFromActionUuid(uuid) : settingsFromActionUuid(".application");
    const settings = normalizeSettings(raw, fallback);
    if (fromUuid.mode === "master") settings.mode = "master";
    const action: ActionInstance = {
      context,
      settings,
      kind: settings.mode === "master" ? "master" : "application",
    };
    this.actions.set(context, action);
    void this.refresh(context);
    return action;
  }

  remove(context: string): void {
    this.actions.delete(context);
    this.inspectors.delete(context);
  }

  get(context: string): ActionInstance | undefined {
    return this.actions.get(context);
  }

  async rotate(context: string, direction: 1 | -1): Promise<void> {
    const action = this.actions.get(context);
    if (!action) return;
    try {
      if (action.kind === "master") {
        if (direction > 0) await this.audio.increaseVolume("master", action.settings.step);
        else await this.audio.decreaseVolume("master", action.settings.step);
      } else {
        if (!action.settings.executable) return this.display.alert(context);
        const query = queryFromSettings(action.settings);
        if (direction > 0) await this.audio.increaseVolume("application", action.settings.step, query);
        else await this.audio.decreaseVolume("application", action.settings.step, query);
      }
      await this.refresh(context);
    } catch (error) {
      logger.error(`rotate failed: ${error instanceof Error ? error.message : String(error)}`);
      this.display.alert(context);
    }
  }

  async press(context: string): Promise<void> {
    const now = Date.now();
    const last = this.lastPressAt.get(context) ?? 0;
    if (now - last < 200) return;
    this.lastPressAt.set(context, now);
    const action = this.actions.get(context);
    if (!action) return;
    try {
      if (action.kind === "master") {
        await this.audio.toggleMute("master");
      } else {
        if (!action.settings.executable) return this.display.alert(context);
        await this.audio.toggleMute("application", queryFromSettings(action.settings));
      }
      await this.refresh(context);
    } catch (error) {
      logger.error(`press failed: ${error instanceof Error ? error.message : String(error)}`);
      this.display.alert(context);
    }
  }

  async refresh(context: string): Promise<void> {
    const pending = this.renderQueue.get(context) ?? Promise.resolve();
    const next = pending.then(() => this.refreshNow(context)).catch((error) => {
      logger.warn(`refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    });
    this.renderQueue.set(context, next);
    await next;
  }

  async refreshAll(): Promise<void> {
    await Promise.all([...this.actions.keys()].map((context) => this.refresh(context)));
  }

  inspectorOpened(context: string): void {
    this.inspectors.add(context);
    this.pushApplications(context);
  }

  private async refreshNow(context: string): Promise<void> {
    const action = this.actions.get(context);
    if (!action) return;
    try {
      if (action.kind === "master") {
        const state = await this.audio.getVolume("master");
        this.display.render(context, viewFromMaster(state, action.settings));
        return;
      }
      if (!action.settings.executable) {
        this.display.render(context, {
          title: "APP",
          percent: 0,
          muted: false,
          waiting: true,
        });
        return;
      }
      const state = await this.audio.getVolume("application", queryFromSettings(action.settings));
      if (state.displayName && state.displayName !== action.settings.displayName) {
        action.settings.displayName = state.displayName;
      }
      this.display.render(context, viewFromApp(state, action.settings));
    } catch (error) {
      logger.warn(`display refresh failed: ${error instanceof Error ? error.message : String(error)}`);
      this.display.render(context, {
        title: action.kind === "master" ? "SYSTEM" : action.settings.displayName || "APP",
        percent: 0,
        muted: false,
        waiting: false,
        error: "Error",
      });
    }
  }

  private async onSessionsChanged(_sessions: AudioSession[]): Promise<void> {
    await this.refreshAll();
    this.pushApplicationsToInspectors();
  }

  private async onMasterChanged(_state: VolumeState): Promise<void> {
    await Promise.all(
      [...this.actions.entries()]
        .filter(([, action]) => action.kind === "master")
        .map(([context]) => this.refresh(context)),
    );
  }

  private async onAppChanged(state: AppVolumeState): Promise<void> {
    await Promise.all(
      [...this.actions.entries()]
        .filter(([, action]) => {
          if (action.kind !== "application") return false;
          return action.settings.executable.toLowerCase() === state.executable.toLowerCase();
        })
        .map(([context]) => this.refresh(context)),
    );
  }

  private async pushApplicationsToInspectors(): Promise<void> {
    await Promise.all([...this.inspectors].map((context) => this.pushApplications(context)));
  }

  private async pushApplications(context: string): Promise<void> {
    const applications = await this.audio.listApplications();
    const action = this.actions.get(context);
    this.host.sendToPropertyInspector(
      {
        type: "applications",
        applications,
        settings: action ? persistableSettings(action.settings) : undefined,
        helperConnected: this.audio.isConnected(),
      },
      context,
    );
  }

  saveFromInspector(context: string, raw: unknown, uuid: string): void {
    const action = this.upsert(context, raw, uuid);
    this.host.setSettings(persistableSettings(action.settings), context);
  }
}

export function payloadOf(message: UlanziMessage): Record<string, unknown> {
  return (message.payload || message.param || message.settings || {}) as Record<string, unknown>;
}
