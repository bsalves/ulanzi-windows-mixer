import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { MockAudioBackend } from "../com.ulanzi.windowsaudio.ulanziPlugin/plugin/lib/audio/MockAudioBackend.js";
import { toPercent } from "../com.ulanzi.windowsaudio.ulanziPlugin/plugin/lib/volume.js";

const discord = {
  sessionId: "d1",
  pid: 111,
  executable: "Discord.exe",
  displayName: "Discord",
  volume: 0.72,
  muted: false,
};

describe("application volume backend", () => {
  /** @type {MockAudioBackend} */
  let backend;

  beforeEach(async () => {
    backend = new MockAudioBackend([discord]);
    await backend.start();
  });

  it("gets, sets, increases and decreases application volume", async () => {
    const query = { executable: "Discord.exe", sessionMode: "all" };
    assert.equal(toPercent((await backend.getApp(query)).volume), 72);
    await backend.setAppVolume(query, 0.5);
    assert.equal(toPercent((await backend.getApp(query)).volume), 50);
    await backend.adjustAppVolume(query, 0.02);
    assert.equal(toPercent((await backend.getApp(query)).volume), 52);
    await backend.adjustAppVolume(query, -0.02);
    assert.equal(toPercent((await backend.getApp(query)).volume), 50);
  });

  it("mutes without permanently zeroing volume", async () => {
    const query = { executable: "Discord.exe", sessionMode: "all" };
    await backend.setAppVolume(query, 0.72);
    await backend.toggleAppMute(query);
    const muted = await backend.getApp(query);
    assert.equal(muted.muted, true);
    assert.equal(toPercent(muted.volume), 72);
    await backend.toggleAppMute(query);
    const restored = await backend.getApp(query);
    assert.equal(restored.muted, false);
    assert.equal(toPercent(restored.volume), 72);
  });

  it("waits for an application that has no session yet", async () => {
    const query = { executable: "chrome.exe", displayName: "Google Chrome", sessionMode: "all" };
    const waiting = await backend.getApp(query);
    assert.equal(waiting.waiting, true);
    backend.addSession({
      sessionId: "c1",
      pid: 222,
      executable: "chrome.exe",
      displayName: "Google Chrome",
      volume: 0.4,
      muted: false,
    });
    const live = await backend.getApp(query);
    assert.equal(live.waiting, false);
    assert.equal(toPercent(live.volume), 40);
  });

  it("recovers when an application closes and restarts with a new PID", async () => {
    const query = { executable: "Discord.exe", pid: 111, sessionMode: "all" };
    backend.removeByExecutable("Discord.exe");
    assert.equal((await backend.getApp(query)).waiting, true);
    backend.addSession({ ...discord, pid: 333, sessionId: "d2" });
    const live = await backend.getApp(query);
    assert.equal(live.waiting, false);
    assert.equal(live.pid, 333);
  });
});

describe("master volume backend", () => {
  it("gets, sets, increases, decreases, mutes and unmutes", async () => {
    const backend = new MockAudioBackend();
    await backend.start();
    await backend.setMasterVolume(0.5);
    assert.equal(toPercent((await backend.getMaster()).volume), 50);
    await backend.adjustMasterVolume(0.02);
    assert.equal(toPercent((await backend.getMaster()).volume), 52);
    await backend.adjustMasterVolume(-0.02);
    assert.equal(toPercent((await backend.getMaster()).volume), 50);
    await backend.toggleMasterMute();
    assert.equal((await backend.getMaster()).muted, true);
    assert.equal(toPercent((await backend.getMaster()).volume), 50);
    await backend.toggleMasterMute();
    assert.equal((await backend.getMaster()).muted, false);
  });
});
