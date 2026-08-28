import type { AppQuery, AppVolumeState, AudioSession, SessionMode, VolumeState } from "./types.js";

export function normalizeExecutable(name: string): string {
  return name.replace(/^.*[/\\]/, "").trim().toLowerCase();
}

export function matchSessions(
  sessions: AudioSession[],
  query: AppQuery,
): AudioSession[] {
  const exe = normalizeExecutable(query.executable);
  if (!exe) return [];

  const byPid = query.pid
    ? sessions.filter((session) => session.pid === query.pid && normalizeExecutable(session.executable) === exe)
    : [];
  const byExe = sessions.filter((session) => normalizeExecutable(session.executable) === exe);
  let matched = byPid.length > 0 ? byPid : byExe;

  if (query.sessionId) {
    const bySession = matched.filter((session) => session.sessionId === query.sessionId);
    if (bySession.length > 0) matched = bySession;
  }

  matched.sort((a, b) => a.pid - b.pid || a.sessionId.localeCompare(b.sessionId));
  if (query.sessionMode === "first" && matched.length > 0) {
    return [matched[0]];
  }
  return matched;
}

export function aggregateSessions(
  matched: AudioSession[],
  query: AppQuery,
  lastKnown?: VolumeState,
): AppVolumeState {
  if (matched.length === 0) {
    return {
      executable: query.executable,
      displayName: query.displayName || stripExeName(query.executable),
      volume: lastKnown?.volume ?? 0,
      muted: lastKnown?.muted ?? false,
      sessionCount: 0,
      waiting: true,
      pid: query.pid,
      sessionId: query.sessionId,
    };
  }

  const volumes = matched.map((session) => session.volume);
  const volume = Math.max(...volumes);
  const muted = matched.every((session) => session.muted);
  const primary = matched[0];
  return {
    executable: primary.executable,
    displayName: query.displayName || primary.displayName || stripExeName(primary.executable),
    volume,
    muted,
    sessionCount: matched.length,
    waiting: false,
    pid: primary.pid,
    sessionId: primary.sessionId,
  };
}

export function stripExeName(executable: string): string {
  return executable.replace(/^.*[/\\]/, "").replace(/\.exe$/i, "");
}

export function groupSessionsByExecutable(sessions: AudioSession[]): Map<string, AudioSession[]> {
  const groups = new Map<string, AudioSession[]>();
  for (const session of sessions) {
    const key = normalizeExecutable(session.executable) || `pid:${session.pid}`;
    const list = groups.get(key) ?? [];
    list.push(session);
    groups.set(key, list);
  }
  return groups;
}

export function uniqueApplications(sessions: AudioSession[]): Array<{
  executable: string;
  displayName: string;
  pid: number;
  sessionCount: number;
}> {
  const groups = groupSessionsByExecutable(sessions);
  const apps = [];
  for (const [, list] of groups) {
    const primary = list[0];
    apps.push({
      executable: primary.executable,
      displayName: primary.displayName || stripExeName(primary.executable),
      pid: primary.pid,
      sessionCount: list.length,
    });
  }
  apps.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return apps;
}

export function sessionModeOrDefault(mode: SessionMode | undefined): SessionMode {
  return mode === "first" ? "first" : "all";
}
