import type { AppQuery, AppVolumeState, AudioSession, VolumeState } from "../types.js";

export const PIPE_NAME = "ulanzi-windows-audio-helper";
export const HELPER_PROTOCOL_VERSION = 1;

export type HelperCommand =
  | "ping"
  | "listSessions"
  | "listDevices"
  | "getMaster"
  | "setMasterVolume"
  | "setMasterMute"
  | "toggleMasterMute"
  | "adjustMasterVolume"
  | "getApp"
  | "setAppVolume"
  | "setAppMute"
  | "toggleAppMute"
  | "adjustAppVolume";

export interface HelperRequest {
  id: string;
  cmd: HelperCommand;
  volume?: number;
  muted?: boolean;
  delta?: number;
  executable?: string;
  displayName?: string;
  pid?: number;
  sessionId?: string;
  sessionMode?: "all" | "first";
  flow?: "render" | "capture";
}

export interface HelperResponse {
  id: string;
  ok: boolean;
  error?: string;
  code?: string;
  data?: unknown;
}

export interface HelperEvent {
  type: "event";
  event: "sessionsChanged" | "masterChanged" | "appChanged" | "helperReady";
  data?: unknown;
}

export function encodeRequest(request: HelperRequest): string {
  return `${JSON.stringify(request)}\n`;
}

export function decodeMessage(line: string): HelperResponse | HelperEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.type === "event" && typeof obj.event === "string") {
    return obj as unknown as HelperEvent;
  }
  if (typeof obj.id === "string" && typeof obj.ok === "boolean") {
    return obj as unknown as HelperResponse;
  }
  return null;
}

export function isEvent(value: HelperResponse | HelperEvent): value is HelperEvent {
  return (value as HelperEvent).type === "event";
}

export function appQueryToPayload(query: AppQuery): Partial<HelperRequest> {
  return {
    executable: query.executable,
    displayName: query.displayName,
    pid: query.pid,
    sessionId: query.sessionId,
    sessionMode: query.sessionMode,
  };
}

export function asVolumeState(data: unknown): VolumeState {
  const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    volume: Number(obj.volume) || 0,
    muted: Boolean(obj.muted),
  };
}

export function asAppVolumeState(data: unknown, query: AppQuery): AppVolumeState {
  const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    executable: String(obj.executable || query.executable),
    displayName: String(obj.displayName || query.displayName || query.executable),
    volume: Number(obj.volume) || 0,
    muted: Boolean(obj.muted),
    sessionCount: Number(obj.sessionCount) || 0,
    waiting: Boolean(obj.waiting),
    pid: typeof obj.pid === "number" ? obj.pid : query.pid,
    sessionId: typeof obj.sessionId === "string" ? obj.sessionId : query.sessionId,
  };
}

export function asSessionList(data: unknown): AudioSession[] {
  const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const list = Array.isArray(obj.sessions) ? obj.sessions : Array.isArray(data) ? data : [];
  return list.map((item) => {
    const session = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      sessionId: String(session.sessionId || ""),
      pid: Number(session.pid) || 0,
      executable: String(session.executable || ""),
      displayName: String(session.displayName || session.executable || ""),
      volume: Number(session.volume) || 0,
      muted: Boolean(session.muted),
    };
  });
}
