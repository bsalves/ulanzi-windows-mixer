import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AudioManager } from "../com.ulanzi.windowsaudio.ulanziPlugin/plugin/lib/audio/AudioManager.js";
import { MockAudioBackend } from "../com.ulanzi.windowsaudio.ulanziPlugin/plugin/lib/audio/MockAudioBackend.js";
import { ActionController } from "../com.ulanzi.windowsaudio.ulanziPlugin/plugin/lib/actions/controller.js";
import { DisplayManager } from "../com.ulanzi.windowsaudio.ulanziPlugin/plugin/lib/ulanzi/DisplayManager.js";
import { FakeHost } from "./fake-host.js";

const APP_UUID = "com.ulanzi.ulanzistudio.windowsaudio.application";
const MASTER_UUID = "com.ulanzi.ulanzistudio.windowsaudio.master";

function context(uuid) {
  return `${uuid}___key1___action1`;
}

async function setup(kind) {
  const host = new FakeHost();
  const backend = new MockAudioBackend([
    { sessionId: "d1", pid: 1, executable: "Discord.exe", displayName: "Discord", volume: 0.5, muted: false },
  ]);
  const audio = new AudioManager(backend);
  const display = new DisplayManager(host);
  const actions = new ActionController(host, audio, display);
  actions.bind();
  await backend.start();
  const ctx = context(kind === "master" ? MASTER_UUID : APP_UUID);
  actions.upsert(
    ctx,
    kind === "master"
      ? { mode: "master", step: 2 }
      : { mode: "application", executable: "Discord.exe", displayName: "Discord", step: 2 },
    kind === "master" ? MASTER_UUID : APP_UUID,
  );
  await actions.refresh(ctx);
  return { host, backend, actions, ctx };
}

describe("Ulanzi encoder and keypad events", () => {
  it("increases volume on clockwise rotation", async () => {
    const { actions, ctx, host } = await setup("application");
    await actions.rotate(ctx, 1);
    const icon = host.lastIcon(ctx);
    assert.equal(icon.text, "52%");
  });

  it("decreases volume on counter-clockwise rotation", async () => {
    const { actions, ctx, host } = await setup("application");
    await actions.rotate(ctx, -1);
    assert.equal(host.lastIcon(ctx).text, "48%");
  });

  it("toggles mute on encoder/key press and restores volume", async () => {
    const { actions, ctx, host } = await setup("application");
    await actions.press(ctx);
    assert.equal(host.lastIcon(ctx).text, "MUTE");
    assert.equal(host.lastIcon(ctx).state, 1);
    await new Promise((resolve) => setTimeout(resolve, 220));
    await actions.press(ctx);
    assert.equal(host.lastIcon(ctx).text, "50%");
    assert.equal(host.lastIcon(ctx).state, 0);
  });

  it("updates the encoder feedback layout", async () => {
    const { host, ctx } = await setup("master");
    assert.ok(host.feedbackLayouts.some((item) => item.layout === "$UA1"));
    assert.ok(host.feedback.some((item) => item.context === ctx));
  });

  it("drops state when the action is cleared after a disconnect", async () => {
    const { actions, ctx } = await setup("application");
    actions.remove(ctx);
    assert.equal(actions.get(ctx), undefined);
  });
});
