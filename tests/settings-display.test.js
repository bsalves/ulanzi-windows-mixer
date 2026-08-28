import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSettings, persistableSettings } from "../com.ulanzi.windowsaudio.ulanziPlugin/plugin/lib/settings.js";
import { formatEncoderTitle, formatKeypadText, volumeBar } from "../com.ulanzi.windowsaudio.ulanziPlugin/plugin/lib/display.js";

describe("settings persistence", () => {
  it("stores executable name rather than only the visual label", () => {
    const settings = normalizeSettings({
      application: "Discord.exe",
      displayName: "Discord",
      step: 5,
      sessionMode: "all",
    });
    assert.equal(settings.executable, "Discord.exe");
    assert.equal(settings.displayName, "Discord");
    const persisted = persistableSettings(settings);
    assert.equal(persisted.executable, "Discord.exe");
    assert.equal("pid" in persisted, false);
  });

  it("defaults step to 2% and session mode to all", () => {
    const settings = normalizeSettings({});
    assert.equal(settings.step, 2);
    assert.equal(settings.sessionMode, "all");
    assert.equal(settings.pressAction, "toggleMute");
  });
});

describe("display formatting", () => {
  it("shows percent, muted and waiting states", () => {
    assert.equal(formatEncoderTitle({ title: "DISCORD", percent: 72, muted: false, waiting: false }), "72%");
    assert.equal(formatEncoderTitle({ title: "DISCORD", percent: 72, muted: true, waiting: false }), "MUTED");
    assert.equal(formatEncoderTitle({ title: "CHROME", percent: 0, muted: false, waiting: true }), "Waiting...");
    assert.equal(formatKeypadText({ title: "DISCORD", percent: 72, muted: false, waiting: false }), "72%");
    assert.match(volumeBar(72), /█/);
  });
});
