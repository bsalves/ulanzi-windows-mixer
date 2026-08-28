import { EventEmitter } from "node:events";
import type { AppQuery, AppVolumeState, AudioDevice, AudioSession, VolumeState } from "../types.js";

export interface AudioBackend extends EventEmitter {
  start(): Promise<void>;
  stop(): Promise<void>;
  isConnected(): boolean;
  listSessions(): Promise<AudioSession[]>;
  listDevices(flow?: "render" | "capture"): Promise<AudioDevice[]>;
  getMaster(): Promise<VolumeState>;
  setMasterVolume(volume: number): Promise<VolumeState>;
  setMasterMute(muted: boolean): Promise<VolumeState>;
  toggleMasterMute(): Promise<VolumeState>;
  adjustMasterVolume(delta: number): Promise<VolumeState>;
  getApp(query: AppQuery): Promise<AppVolumeState>;
  setAppVolume(query: AppQuery, volume: number): Promise<AppVolumeState>;
  setAppMute(query: AppQuery, muted: boolean): Promise<AppVolumeState>;
  toggleAppMute(query: AppQuery): Promise<AppVolumeState>;
  adjustAppVolume(query: AppQuery, delta: number): Promise<AppVolumeState>;
}

export type BackendEvent = "sessionsChanged" | "masterChanged" | "appChanged" | "helperStatus";
