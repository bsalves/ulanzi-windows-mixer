import { AudioHelperClient } from "./ipc/AudioHelperClient.js";
import { MockAudioBackend } from "./audio/MockAudioBackend.js";
import { AudioManager } from "./audio/AudioManager.js";
import { DisplayManager } from "./ulanzi/DisplayManager.js";
import { ActionController, payloadOf } from "./actions/controller.js";
import { logger } from "./logger.js";
import { PLUGIN_UUID } from "./types.js";
import type { UlanziHost, UlanziUtils } from "./types.js";
import type { AudioBackend } from "./audio/AudioBackend.js";

export interface StartOptions {
  backend?: AudioBackend;
  forceMock?: boolean;
}

export function createBackend(utils: UlanziUtils, forceMock = false): AudioBackend {
  const pluginRoot = utils.getPluginPath();
  const system = typeof utils.getSystemType === "function" ? utils.getSystemType() : process.platform === "win32" ? "windows" : "mac";
  if (forceMock || process.env.ULN_AUDIO_MOCK === "1" || system !== "windows") {
    logger.info("Using mock audio backend");
    return new MockAudioBackend([
      {
        sessionId: "mock-discord",
        pid: 1001,
        executable: "Discord.exe",
        displayName: "Discord",
        volume: 0.72,
        muted: false,
      },
      {
        sessionId: "mock-spotify",
        pid: 1002,
        executable: "Spotify.exe",
        displayName: "Spotify",
        volume: 0.4,
        muted: false,
      },
      {
        sessionId: "mock-chrome",
        pid: 1003,
        executable: "chrome.exe",
        displayName: "Google Chrome",
        volume: 0.55,
        muted: false,
      },
    ]);
  }
  return new AudioHelperClient(pluginRoot);
}

export function start($UD: UlanziHost, utils: UlanziUtils, options: StartOptions = {}): ActionController {
  logger.attach($UD);
  const backend = options.backend ?? createBackend(utils, options.forceMock);
  const audio = new AudioManager(backend);
  const display = new DisplayManager($UD);
  const actions = new ActionController($UD, audio, display);
  actions.bind();

  $UD.connect(PLUGIN_UUID);

  $UD.onConnected(() => {
    logger.info("Windows Audio Mixer connected to Ulanzi Studio");
    $UD.getGlobalSettings();
    void audio.start();
  });

  $UD.onDidReceiveGlobalSettings((message) => {
    const settings = (message.settings || message.param || {}) as { debug?: boolean };
    logger.setDebug(Boolean(settings.debug));
  });

  $UD.onAdd((message) => {
    const uuid = message.uuid || $UD.decodeContext(message.context).uuid;
    actions.upsert(message.context, message.param, uuid);
    $UD.getSettings(message.context);
  });

  $UD.onDidReceiveSettings((message) => {
    const uuid = message.uuid || $UD.decodeContext(message.context).uuid;
    actions.upsert(message.context, message.settings || message.param, uuid);
  });

  $UD.onParamFromApp((message) => {
    const uuid = message.uuid || $UD.decodeContext(message.context).uuid;
    actions.upsert(message.context, message.param, uuid);
  });

  $UD.onClear((message) => {
    for (const item of message.param ?? []) {
      actions.remove(item.context);
    }
  });

  $UD.onRun((message) => {
    void actions.press(message.context);
  });

  $UD.onDialDown((message) => {
    void actions.press(message.context);
  });

  $UD.onDialRotateRight((message) => {
    void actions.rotate(message.context, 1);
  });

  $UD.onDialRotateLeft((message) => {
    void actions.rotate(message.context, -1);
  });
  $UD.onDialRotateHoldRight?.((message) => {
    void actions.rotate(message.context, 1);
  });
  $UD.onDialRotateHoldLeft?.((message) => {
    void actions.rotate(message.context, -1);
  });

  $UD.onSendToPlugin((message) => {
    const payload = payloadOf(message);
    const uuid = message.uuid || $UD.decodeContext(message.context).uuid;
    actions.inspectorOpened(message.context);
    if (payload.type === "save" || payload.executable !== undefined || payload.step !== undefined) {
      actions.saveFromInspector(message.context, payload.settings || payload, uuid);
    }
    if (payload.type === "setDebug") {
      logger.setDebug(Boolean(payload.debug));
      $UD.setGlobalSettings({ debug: Boolean(payload.debug) });
    }
  });

  $UD.onClose(() => {
    logger.warn("Ulanzi connection closed");
    void audio.stop();
  });

  return actions;
}
