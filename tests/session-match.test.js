import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchSessions, aggregateSessions, uniqueApplications } from "../com.ulanzi.windowsaudio.ulanziPlugin/plugin/lib/session-match.js";

const sessions = [
  { sessionId: "a", pid: 10, executable: "Discord.exe", displayName: "Discord", volume: 0.7, muted: false },
  { sessionId: "b", pid: 10, executable: "Discord.exe", displayName: "Discord", volume: 0.4, muted: true },
  { sessionId: "c", pid: 22, executable: "chrome.exe", displayName: "Google Chrome", volume: 0.3, muted: false },
];

describe("application session matching", () => {
  it("finds an application by executable name", () => {
    const matched = matchSessions(sessions, { executable: "Discord.exe", sessionMode: "all" });
    assert.equal(matched.length, 2);
  });

  it("prefers a live PID and falls back to executable after restart", () => {
    const live = matchSessions(sessions, { executable: "Discord.exe", pid: 10, sessionMode: "all" });
    assert.equal(live.length, 2);
    const restarted = matchSessions(sessions, { executable: "Discord.exe", pid: 99999, sessionMode: "all" });
    assert.equal(restarted.length, 2);
  });

  it("can target only the first session", () => {
    const matched = matchSessions(sessions, { executable: "Discord.exe", sessionMode: "first" });
    assert.equal(matched.length, 1);
    assert.equal(matched[0].sessionId, "a");
  });

  it("aggregates all sessions and reports waiting when none exist", () => {
    const live = aggregateSessions(
      matchSessions(sessions, { executable: "Discord.exe", sessionMode: "all" }),
      { executable: "Discord.exe", sessionMode: "all" },
    );
    assert.equal(live.waiting, false);
    assert.equal(live.sessionCount, 2);
    assert.equal(live.volume, 0.7);
    assert.equal(live.muted, false);

    const waiting = aggregateSessions([], { executable: "chrome.exe", displayName: "Google Chrome", sessionMode: "all" });
    assert.equal(waiting.waiting, true);
    assert.equal(waiting.displayName, "Google Chrome");
  });

  it("lists unique applications for the picker", () => {
    const apps = uniqueApplications(sessions);
    assert.deepEqual(apps.map((app) => app.executable), ["Discord.exe", "chrome.exe"]);
  });
});
