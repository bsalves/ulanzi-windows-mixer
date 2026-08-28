import { EventEmitter } from "node:events";
import type { AudioBackend } from "./AudioBackend.js";
import { uniqueApplications } from "../session-match.js";
import type { AppQuery, AppVolumeState, AudioDevice, AudioSession, VolumeState } from "../types.js";
import { logger } from "../logger.js";

/**
 * High-level audio facade used by Ulanzi actions.
 * Device enumeration is exposed for future input/output routing actions
 * and is intentionally not mixed into application volume control.
 */
export class AudioManager extends EventEmitter {
  constructor(private readonly backend: AudioBackend) {
    super();
    this.backend.on("sessionsChanged", (sessions: AudioSession[]) => {
      this.emit("sessionsChanged", sessions);
    });
    this.backend.on("masterChanged", (state: VolumeState) => this.emit("masterChanged", state));
    this.backend.on("appChanged", (state: AppVolumeState) => this.emit("appChanged", state));
    this.backend.on("helperStatus", (status) => this.emit("helperStatus", status));
  }

  async start(): Promise<void> {
    await this.backend.start();
  }

  async stop(): Promise<void> {
    await this.backend.stop();
  }

  isConnected(): boolean {
    return this.backend.isConnected();
  }

  async listApplications() {
    const sessions = await this.safe("listSessions", () => this.backend.listSessions(), []);
    return uniqueApplications(sessions);
  }

  async listSessions(): Promise<AudioSession[]> {
    return this.safe("listSessions", () => this.backend.listSessions(), []);
  }

  async listPlaybackDevices(): Promise<AudioDevice[]> {
    return this.safe("listDevices", () => this.backend.listDevices("render"), []);
  }

  async listCaptureDevices(): Promise<AudioDevice[]> {
    return this.safe("listDevices", () => this.backend.listDevices("capture"), []);
  }

  getVolume(kind: "master", query?: AppQuery): Promise<VolumeState>;
  getVolume(kind: "application", query: AppQuery): Promise<AppVolumeState>;
  getVolume(kind: "master" | "application", query?: AppQuery): Promise<VolumeState | AppVolumeState> {
    if (kind === "master") return this.backend.getMaster();
    return this.backend.getApp(query!);
  }

  setVolume(kind: "master", volume: number, query?: AppQuery): Promise<VolumeState>;
  setVolume(kind: "application", volume: number, query: AppQuery): Promise<AppVolumeState>;
  setVolume(
    kind: "master" | "application",
    volume: number,
    query?: AppQuery,
  ): Promise<VolumeState | AppVolumeState> {
    if (kind === "master") return this.backend.setMasterVolume(volume);
    return this.backend.setAppVolume(query!, volume);
  }

  increaseVolume(kind: "master", stepPercent: number, query?: AppQuery): Promise<VolumeState>;
  increaseVolume(kind: "application", stepPercent: number, query: AppQuery): Promise<AppVolumeState>;
  increaseVolume(
    kind: "master" | "application",
    stepPercent: number,
    query?: AppQuery,
  ): Promise<VolumeState | AppVolumeState> {
    const delta = stepPercent / 100;
    if (kind === "master") return this.backend.adjustMasterVolume(delta);
    return this.backend.adjustAppVolume(query!, delta);
  }

  decreaseVolume(kind: "master", stepPercent: number, query?: AppQuery): Promise<VolumeState>;
  decreaseVolume(kind: "application", stepPercent: number, query: AppQuery): Promise<AppVolumeState>;
  decreaseVolume(
    kind: "master" | "application",
    stepPercent: number,
    query?: AppQuery,
  ): Promise<VolumeState | AppVolumeState> {
    const delta = -(stepPercent / 100);
    if (kind === "master") return this.backend.adjustMasterVolume(delta);
    return this.backend.adjustAppVolume(query!, delta);
  }

  toggleMute(kind: "master", query?: AppQuery): Promise<VolumeState>;
  toggleMute(kind: "application", query: AppQuery): Promise<AppVolumeState>;
  toggleMute(kind: "master" | "application", query?: AppQuery): Promise<VolumeState | AppVolumeState> {
    if (kind === "master") return this.backend.toggleMasterMute();
    return this.backend.toggleAppMute(query!);
  }

  getMuteState(kind: "master", query?: AppQuery): Promise<boolean>;
  getMuteState(kind: "application", query: AppQuery): Promise<boolean>;
  async getMuteState(kind: "master" | "application", query?: AppQuery): Promise<boolean> {
    if (kind === "master") return (await this.backend.getMaster()).muted;
    return (await this.backend.getApp(query!)).muted;
  }

  private async safe<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      logger.warn(`${name} failed: ${error instanceof Error ? error.message : String(error)}`);
      return fallback;
    }
  }
}
