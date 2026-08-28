export const PLUGIN_UUID = "com.ulanzi.ulanzistudio.windowsaudio";
export const MASTER_ACTION_UUID = `${PLUGIN_UUID}.master`;
export const APPLICATION_ACTION_UUID = `${PLUGIN_UUID}.application`;

export const VALID_STEPS = [1, 2, 5, 10] as const;
export type StepPercent = (typeof VALID_STEPS)[number];

export type VolumeMode = "master" | "application" | "input" | "output";
export type SessionMode = "all" | "first";
export type PressAction = "toggleMute" | "volumeUp" | "volumeDown";

export interface ActionSettings {
  mode: VolumeMode;
  executable: string;
  displayName: string;
  pid?: number;
  sessionId?: string;
  step: StepPercent;
  pressAction: PressAction;
  sessionMode: SessionMode;
}

export interface AudioSession {
  sessionId: string;
  pid: number;
  executable: string;
  displayName: string;
  volume: number;
  muted: boolean;
}

export interface VolumeState {
  volume: number;
  muted: boolean;
}

export interface AppVolumeState extends VolumeState {
  executable: string;
  displayName: string;
  pid?: number;
  sessionId?: string;
  sessionCount: number;
  waiting: boolean;
}

export interface AppQuery {
  executable: string;
  displayName?: string;
  pid?: number;
  sessionId?: string;
  sessionMode: SessionMode;
}

export interface AudioDevice {
  id: string;
  name: string;
  flow: "render" | "capture";
  isDefault: boolean;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface UlanziHost {
  connect(uuid: string): void;
  onConnected(fn: (data?: unknown) => void): unknown;
  onClose(fn: () => void): unknown;
  onError(fn: (error: string) => void): unknown;
  onAdd(fn: (message: UlanziMessage) => void): unknown;
  onRun(fn: (message: UlanziMessage) => void): unknown;
  onClear(fn: (message: UlanziClearMessage) => void): unknown;
  onSetActive(fn: (message: UlanziMessage & { active: boolean }) => void): unknown;
  onParamFromApp(fn: (message: UlanziMessage) => void): unknown;
  onDidReceiveSettings(fn: (message: UlanziMessage) => void): unknown;
  onDidReceiveGlobalSettings(fn: (message: UlanziMessage) => void): unknown;
  onSendToPlugin(fn: (message: UlanziMessage) => void): unknown;
  onDialDown(fn: (message: UlanziMessage) => void): unknown;
  onDialUp(fn: (message: UlanziMessage) => void): unknown;
  onDialRotate(fn: (message: UlanziRotateMessage) => void): unknown;
  onDialRotateLeft(fn: (message: UlanziMessage) => void): unknown;
  onDialRotateRight(fn: (message: UlanziMessage) => void): unknown;
  onDialRotateHoldLeft?(fn: (message: UlanziMessage) => void): unknown;
  onDialRotateHoldRight?(fn: (message: UlanziMessage) => void): unknown;
  setStateIcon(context: string, state: number, text?: string): void;
  setTitle(context: string, text: string): void;
  setFeedbackLayout(context: string, layout: string): void;
  setFeedback(context: string, layout: Record<string, unknown>): void;
  setSettings(settings: unknown, context: string): void;
  getSettings(context: string): void;
  getGlobalSettings(): void;
  setGlobalSettings(settings: unknown): void;
  sendToPropertyInspector(data: unknown, context: string): void;
  sendParamFromPlugin(settings: unknown, context: string): void;
  showAlert(context: string): void;
  toast(msg: string): void;
  logMessage(msg: string, level?: LogLevel): void;
  decodeContext(context: string): { uuid: string; key: string; actionid: string };
}

export interface UlanziUtils {
  getPluginPath(): string;
  getSystemType(): "windows" | "mac";
}

export interface UlanziMessage {
  context: string;
  uuid?: string;
  key?: string;
  actionid?: string;
  param?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
}

export interface UlanziClearMessage {
  param?: Array<{ context: string }> | null;
}

export interface UlanziRotateMessage extends UlanziMessage {
  rotateEvent?: "left" | "right" | "hold-left" | "hold-right";
}

export type AudioEventMap = {
  sessionsChanged: AudioSession[];
  masterChanged: VolumeState;
  appChanged: AppVolumeState;
  helperStatus: { connected: boolean; error?: string };
};
