import { EventEmitter } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";
import { logger } from "../logger.js";
import type { AppQuery, AppVolumeState, AudioDevice, AudioSession, VolumeState } from "../types.js";
import { clampVolume } from "../volume.js";
import type { AudioBackend } from "../audio/AudioBackend.js";
import {
  appQueryToPayload,
  asAppVolumeState,
  asSessionList,
  asVolumeState,
  decodeMessage,
  encodeRequest,
  isEvent,
  PIPE_NAME,
  type HelperCommand,
  type HelperRequest,
  type HelperResponse,
} from "../ipc/protocol.js";

const REQUEST_TIMEOUT_MS = 3000;
const RESTART_BACKOFF_MS = [1000, 2000, 5000];

interface Pending {
  resolve: (value: HelperResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class AudioHelperClient extends EventEmitter implements AudioBackend {
  private socket: net.Socket | null = null;
  private child: ChildProcess | null = null;
  private buffer = "";
  private nextId = 1;
  private pending = new Map<string, Pending>();
  private connected = false;
  private stopping = false;
  private restartAttempt = 0;
  private restartTimer: NodeJS.Timeout | null = null;
  private pluginRoot: string;

  constructor(pluginRoot: string) {
    super();
    this.pluginRoot = pluginRoot;
  }

  async start(): Promise<void> {
    this.stopping = false;
    await this.connectWithRetry();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.rejectAll(new Error("helper stopped"));
    this.socket?.destroy();
    this.socket = null;
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
    this.child = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async listSessions(): Promise<AudioSession[]> {
    const response = await this.request("listSessions");
    return asSessionList(response.data);
  }

  async listDevices(flow: "render" | "capture" = "render"): Promise<AudioDevice[]> {
    const response = await this.request("listDevices", { flow });
    const data = response.data && typeof response.data === "object"
      ? (response.data as { devices?: AudioDevice[] })
      : {};
    return Array.isArray(data.devices) ? data.devices : [];
  }

  async getMaster(): Promise<VolumeState> {
    return asVolumeState((await this.request("getMaster")).data);
  }

  async setMasterVolume(volume: number): Promise<VolumeState> {
    return asVolumeState((await this.request("setMasterVolume", { volume: clampVolume(volume) })).data);
  }

  async setMasterMute(muted: boolean): Promise<VolumeState> {
    return asVolumeState((await this.request("setMasterMute", { muted })).data);
  }

  async toggleMasterMute(): Promise<VolumeState> {
    return asVolumeState((await this.request("toggleMasterMute")).data);
  }

  async adjustMasterVolume(delta: number): Promise<VolumeState> {
    return asVolumeState((await this.request("adjustMasterVolume", { delta })).data);
  }

  async getApp(query: AppQuery): Promise<AppVolumeState> {
    return asAppVolumeState((await this.request("getApp", appQueryToPayload(query))).data, query);
  }

  async setAppVolume(query: AppQuery, volume: number): Promise<AppVolumeState> {
    return asAppVolumeState(
      (await this.request("setAppVolume", { ...appQueryToPayload(query), volume: clampVolume(volume) })).data,
      query,
    );
  }

  async setAppMute(query: AppQuery, muted: boolean): Promise<AppVolumeState> {
    return asAppVolumeState(
      (await this.request("setAppMute", { ...appQueryToPayload(query), muted })).data,
      query,
    );
  }

  async toggleAppMute(query: AppQuery): Promise<AppVolumeState> {
    return asAppVolumeState(
      (await this.request("toggleAppMute", appQueryToPayload(query))).data,
      query,
    );
  }

  async adjustAppVolume(query: AppQuery, delta: number): Promise<AppVolumeState> {
    return asAppVolumeState(
      (await this.request("adjustAppVolume", { ...appQueryToPayload(query), delta })).data,
      query,
    );
  }

  private async connectWithRetry(): Promise<void> {
    const started = Date.now();
    while (!this.stopping && Date.now() - started < 8000) {
      try {
        await this.connectPipe();
        return;
      } catch {
        this.ensureHelperProcess();
        await sleep(250);
      }
    }
    this.emit("helperStatus", { connected: false, error: "helper unavailable" });
    this.scheduleRestart();
  }

  private connectPipe(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ path: `\\\\.\\pipe\\${PIPE_NAME}` });
      const onError = (error: Error) => {
        socket.destroy();
        reject(error);
      };
      socket.once("error", onError);
      socket.once("connect", () => {
        socket.off("error", onError);
        this.attachSocket(socket);
        resolve();
      });
    });
  }

  private attachSocket(socket: net.Socket): void {
    this.socket?.destroy();
    this.socket = socket;
    this.buffer = "";
    this.connected = true;
    this.restartAttempt = 0;
    logger.info("Audio helper connected");
    this.emit("helperStatus", { connected: true });

    socket.on("data", (chunk) => this.onData(chunk.toString("utf8")));
    socket.on("error", (error) => {
      logger.warn(`Audio helper socket error: ${error.message}`);
    });
    socket.on("close", () => {
      this.connected = false;
      this.socket = null;
      this.rejectAll(new Error("helper disconnected"));
      this.emit("helperStatus", { connected: false, error: "disconnected" });
      if (!this.stopping) this.scheduleRestart();
    });
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let index = this.buffer.indexOf("\n");
    while (index >= 0) {
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 1);
      this.onLine(line);
      index = this.buffer.indexOf("\n");
    }
    if (this.buffer.length > 1024 * 1024) this.buffer = "";
  }

  private onLine(line: string): void {
    const message = decodeMessage(line);
    if (!message) {
      logger.warn("Audio helper invalid response");
      return;
    }
    if (isEvent(message)) {
      if (message.event === "sessionsChanged") {
        this.emit("sessionsChanged", asSessionList(message.data));
      } else if (message.event === "masterChanged") {
        this.emit("masterChanged", asVolumeState(message.data));
      } else if (message.event === "appChanged") {
        const data = message.data && typeof message.data === "object"
          ? (message.data as Record<string, unknown>)
          : {};
        this.emit("appChanged", asAppVolumeState(message.data, {
          executable: String(data.executable || ""),
          sessionMode: data.sessionMode === "first" ? "first" : "all",
        }));
      }
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (!message.ok) {
      pending.reject(new Error(message.error || message.code || "helper error"));
      return;
    }
    pending.resolve(message);
  }

  private request(cmd: HelperCommand, extra: Partial<HelperRequest> = {}): Promise<HelperResponse> {
    if (!this.socket || !this.connected) {
      return Promise.reject(new Error("helper unavailable"));
    }
    const id = String(this.nextId++);
    const payload: HelperRequest = { id, cmd, ...extra };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("helper timeout"));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.socket!.write(encodeRequest(payload), (error) => {
          if (error) {
            this.pending.delete(id);
            clearTimeout(timer);
            reject(error);
          }
        });
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private ensureHelperProcess(): void {
    if (this.child && !this.child.killed) return;
    const exe = path.join(this.pluginRoot, "native", "ulanzi-audio-helper.exe");
    if (!fs.existsSync(exe)) {
      logger.error(`Audio helper executable missing: ${exe}`);
      return;
    }
    logger.info("Starting audio helper");
    this.child = spawn(exe, [], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.child.stdout?.on("data", (chunk) => logger.debug(`helper: ${String(chunk).trim()}`));
    this.child.stderr?.on("data", (chunk) => logger.warn(`helper: ${String(chunk).trim()}`));
    this.child.on("exit", (code) => {
      logger.warn(`Audio helper exited (${code ?? "null"})`);
      this.child = null;
    });
  }

  private scheduleRestart(): void {
    if (this.stopping || this.restartTimer) return;
    const delay = RESTART_BACKOFF_MS[Math.min(this.restartAttempt, RESTART_BACKOFF_MS.length - 1)];
    this.restartAttempt += 1;
    logger.warn(`Restarting audio helper in ${delay}ms`);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      void this.connectWithRetry();
    }, delay);
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
