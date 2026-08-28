import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyStep, clampVolume, fromPercent, toPercent } from "../com.ulanzi.windowsaudio.ulanziPlugin/plugin/lib/volume.js";

describe("master / volume math", () => {
  it("clamps volume to 0.0–1.0", () => {
    assert.equal(clampVolume(-1), 0);
    assert.equal(clampVolume(2), 1);
    assert.equal(clampVolume(0.5), 0.5);
    assert.equal(clampVolume(Number.NaN), 0);
  });

  it("converts between 0–1 and 0–100%", () => {
    assert.equal(toPercent(0.75), 75);
    assert.equal(fromPercent(75), 0.75);
    assert.equal(toPercent(0.724), 72);
  });

  it("increases and decreases by the configured step", () => {
    let volume = fromPercent(50);
    volume = applyStep(volume, 1, 2);
    assert.equal(toPercent(volume), 52);
    volume = applyStep(volume, 1, 2);
    assert.equal(toPercent(volume), 54);
    volume = applyStep(volume, -1, 2);
    assert.equal(toPercent(volume), 52);
  });

  it("does not go below 0% or above 100%", () => {
    assert.equal(toPercent(applyStep(0, -1, 10)), 0);
    assert.equal(toPercent(applyStep(1, 1, 10)), 100);
  });
});
