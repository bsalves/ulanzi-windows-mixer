export const PIPE_NAME = "ulanzi-windows-audio-helper";
export const HELPER_PROTOCOL_VERSION = 1;
export function encodeRequest(request) {
    return `${JSON.stringify(request)}\n`;
}
export function decodeMessage(line) {
    const trimmed = line.trim();
    if (!trimmed)
        return null;
    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    }
    catch {
        return null;
    }
    if (!parsed || typeof parsed !== "object")
        return null;
    const obj = parsed;
    if (obj.type === "event" && typeof obj.event === "string") {
        return obj;
    }
    if (typeof obj.id === "string" && typeof obj.ok === "boolean") {
        return obj;
    }
    return null;
}
export function isEvent(value) {
    return value.type === "event";
}
export function appQueryToPayload(query) {
    return {
        executable: query.executable,
        displayName: query.displayName,
        pid: query.pid,
        sessionId: query.sessionId,
        sessionMode: query.sessionMode,
    };
}
export function asVolumeState(data) {
    const obj = data && typeof data === "object" ? data : {};
    return {
        volume: Number(obj.volume) || 0,
        muted: Boolean(obj.muted),
    };
}
export function asAppVolumeState(data, query) {
    const obj = data && typeof data === "object" ? data : {};
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
export function asSessionList(data) {
    const obj = data && typeof data === "object" ? data : {};
    const list = Array.isArray(obj.sessions) ? obj.sessions : Array.isArray(data) ? data : [];
    return list.map((item) => {
        const session = item && typeof item === "object" ? item : {};
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
//# sourceMappingURL=protocol.js.map