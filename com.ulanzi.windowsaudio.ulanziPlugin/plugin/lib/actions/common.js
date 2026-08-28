import { toPercent } from "../volume.js";
export function queryFromSettings(settings) {
    return {
        executable: settings.executable,
        displayName: settings.displayName,
        pid: settings.pid,
        sessionId: settings.sessionId,
        sessionMode: settings.sessionMode,
    };
}
export function displayTitle(settings) {
    if (settings.mode === "master")
        return settings.displayName || "SYSTEM";
    return settings.displayName || settings.executable || "APP";
}
export function viewFromMaster(state, settings) {
    return {
        title: displayTitle(settings),
        percent: toPercent(state.volume),
        muted: state.muted,
        waiting: false,
    };
}
export function viewFromApp(state, settings) {
    return {
        title: state.displayName || displayTitle(settings),
        percent: toPercent(state.volume),
        muted: state.muted,
        waiting: state.waiting,
    };
}
export function isMasterAction(uuid) {
    return uuid.endsWith(".master");
}
//# sourceMappingURL=common.js.map