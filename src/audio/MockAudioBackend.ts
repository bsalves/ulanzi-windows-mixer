import { EventEmitter } from "node:events";
import { aggregateSessions, matchSessions, uniqueApplications } from "../session-match.js";
import type { AppQuery, AppVolumeState, AudioDevice, AudioSession, VolumeState } from "../types.js";
import { applyStep, clampVolume, shouldUnmuteOnAdjust } from "../volume.js";
import type { AudioBackend } from "./AudioBackend.js";

interface StoredSession extends AudioSession {}

export class MockAudioBackend extends EventEmitter implements AudioBackend {
  private sessions: StoredSession[] = [];
  private master: VolumeState = { volume: 0.5, muted: false };
  private lastKnown = new Map<string, VolumeState>();
  private connected = false;
  private devices: AudioDevice[] = [
    { id: "default-render", name: "Speakers", flow: "render", isDefault: true },
    { id: "default-capture", name: "Microphone", flow: "capture", isDefault: true },
  ];

  constructor(initial: AudioSession[] = []) {
    super();
    this.sessions = initial.map((session) => ({ ...session }));
  }

  async start(): Promise<void> {
    this.connected = true;
    this.emit("helperStatus", { connected: true });
    this.emit("sessionsChanged", this.snapshot());
    this.emit("masterChanged", { ...this.master });
  }

  async stop(): Promise<void> {
    this.connected = false;
    this.emit("helperStatus", { connected: false });
  }

  isConnected(): boolean {
    return this.connected;
  }

  setSessions(sessions: AudioSession[]): void {
    this.sessions = sessions.map((session) => ({ ...session }));
    this.emit("sessionsChanged", this.snapshot());
  }

  addSession(session: AudioSession): void {
    this.sessions.push({ ...session });
    this.emit("sessionsChanged", this.snapshot());
  }

  removeByExecutable(executable: string): void {
    this.sessions = this.sessions.filter(
      (session) => session.executable.toLowerCase() !== executable.toLowerCase(),
    );
    this.emit("sessionsChanged", this.snapshot());
  }

  async listSessions(): Promise<AudioSession[]> {
    return this.snapshot();
  }

  async listDevices(flow?: "render" | "capture"): Promise<AudioDevice[]> {
    return this.devices.filter((device) => !flow || device.flow === flow);
  }

  async getMaster(): Promise<VolumeState> {
    return { ...this.master };
  }

  async setMasterVolume(volume: number): Promise<VolumeState> {
    this.master.volume = clampVolume(volume);
    if (this.master.volume > 0) this.master.muted = false;
    this.emit("masterChanged", { ...this.master });
    return { ...this.master };
  }

  async setMasterMute(muted: boolean): Promise<VolumeState> {
    this.master.muted = muted;
    this.emit("masterChanged", { ...this.master });
    return { ...this.master };
  }

  async toggleMasterMute(): Promise<VolumeState> {
    return this.setMasterMute(!this.master.muted);
  }

  async adjustMasterVolume(delta: number): Promise<VolumeState> {
    const step = Math.round(Math.abs(delta) * 100) || 2;
    const direction = delta >= 0 ? 1 : -1;
    const next = applyStep(this.master.volume, direction, step as 1 | 2 | 5 | 10);
    if (shouldUnmuteOnAdjust(this.master, next)) this.master.muted = false;
    return this.setMasterVolume(next);
  }

  async getApp(query: AppQuery): Promise<AppVolumeState> {
    return this.appState(query);
  }

  async setAppVolume(query: AppQuery, volume: number): Promise<AppVolumeState> {
    const matched = matchSessions(this.sessions, query);
    const next = clampVolume(volume);
    for (const session of matched) {
      session.volume = next;
      if (next > 0) session.muted = false;
    }
    const state = this.appState(query);
    this.lastKnown.set(query.executable.toLowerCase(), { volume: state.volume, muted: state.muted });
    this.emit("appChanged", state);
    this.emit("sessionsChanged", this.snapshot());
    return state;
  }

  async setAppMute(query: AppQuery, muted: boolean): Promise<AppVolumeState> {
    const matched = matchSessions(this.sessions, query);
    for (const session of matched) session.muted = muted;
    const state = this.appState(query);
    this.lastKnown.set(query.executable.toLowerCase(), { volume: state.volume, muted: state.muted });
    this.emit("appChanged", state);
    this.emit("sessionsChanged", this.snapshot());
    return state;
  }

  async toggleAppMute(query: AppQuery): Promise<AppVolumeState> {
    const current = this.appState(query);
    return this.setAppMute(query, !current.muted);
  }

  async adjustAppVolume(query: AppQuery, delta: number): Promise<AppVolumeState> {
    const current = this.appState(query);
    const step = Math.round(Math.abs(delta) * 100) || 2;
    const direction = delta >= 0 ? 1 : -1;
    const next = applyStep(current.volume, direction, step as 1 | 2 | 5 | 10);
    if (shouldUnmuteOnAdjust(current, next)) {
      await this.setAppMute(query, false);
    }
    return this.setAppVolume(query, next);
  }

  applications() {
    return uniqueApplications(this.sessions);
  }

  private appState(query: AppQuery): AppVolumeState {
    const matched = matchSessions(this.sessions, query);
    return aggregateSessions(
      matched,
      query,
      this.lastKnown.get(query.executable.toLowerCase()),
    );
  }

  private snapshot(): AudioSession[] {
    return this.sessions.map((session) => ({ ...session }));
  }
}
