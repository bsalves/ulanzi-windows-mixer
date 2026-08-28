import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AudioManager } from "../com.ulanzi.windowsaudio.ulanziPlugin/plugin/lib/audio/AudioManager.js";
import { MockAudioBackend } from "../com.ulanzi.windowsaudio.ulanziPlugin/plugin/lib/audio/MockAudioBackend.js";
import { ActionController } from "../com.ulanzi.windowsaudio.ulanziPlugin/plugin/lib/actions/controller.js";
import { DisplayManager } from "../com.ulanzi.windowsaudio.ulanziPlugin/plugin/lib/ulanzi/DisplayManager.js";
import { FakeHost } from "./fake-host.js";

describe("helper lifecycle", () => {
  it("shows an error when the helper is unavailable and recovers after restart", async () => {
    const host = new FakeHost();
    const backend = new MockAudioBackend();
    const audio = new AudioManager(backend);
    const display = new DisplayManager(host);
    const actions = new ActionController(host, audio, display);
    actions.bind();
    const ctx = "com.ulanzi.ulanzistudio.windowsaudio.master___k___a";
    actions.upsert(ctx, { mode: "master", step: 2 }, "com.ulanzi.ulanzistudio.windowsaudio.master");
    await actions.refresh(ctx);
    await backend.stop();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(host.lastIcon(ctx)?.text, "!");
    await backend.start();
    await actions.refresh(ctx);
    assert.notEqual(host.lastIcon(ctx)?.text, "!");
  });
});
