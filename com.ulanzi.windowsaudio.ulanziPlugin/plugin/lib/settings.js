import { VALID_STEPS } from "./types.js";
const DEFAULTS = {
    mode: "application",
    executable: "",
    displayName: "",
    step: 2,
    pressAction: "toggleMute",
    sessionMode: "all",
};
function asString(value) {
    return typeof value === "string" ? value.trim() : "";
}
function asOptionalNumber(value) {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isInteger(n) && n > 0 ? n : undefined;
}
export function defaultSettings(mode) {
    return {
        ...DEFAULTS,
        mode,
        displayName: mode === "master" ? "SYSTEM" : "",
    };
}
export function settingsFromActionUuid(uuid) {
    const mode = uuid.endsWith(".master") ? "master" : "application";
    return defaultSettings(mode);
}
export function normalizeSettings(raw, fallbackMode = "application") {
    const input = raw && typeof raw === "object" ? raw : {};
    const mode = normalizeMode(input.mode, fallbackMode);
    const step = normalizeStep(input.step);
    const sessionMode = input.sessionMode === "first" ? "first" : "all";
    const executable = asString(input.executable || input.application);
    const displayName = asString(input.displayName) || stripExe(executable);
    const settings = {
        mode,
        executable: mode === "master" ? "" : executable,
        displayName: mode === "master" ? (displayName || "SYSTEM") : displayName,
        step,
        pressAction: "toggleMute",
        sessionMode,
    };
    const pid = asOptionalNumber(input.pid);
    if (pid)
        settings.pid = pid;
    const sessionId = asString(input.sessionId);
    if (sessionId)
        settings.sessionId = sessionId;
    return settings;
}
export function normalizeStep(value) {
    const n = typeof value === "number" ? value : Number(value);
    return VALID_STEPS.includes(n) ? n : 2;
}
export function normalizeMode(value, fallback) {
    if (value === "master" || value === "application" || value === "input" || value === "output") {
        return value;
    }
    return fallback;
}
export function stripExe(executable) {
    return executable.replace(/\.exe$/i, "");
}
export function persistableSettings(settings) {
    const copy = {
        mode: settings.mode,
        executable: settings.executable,
        displayName: settings.displayName,
        step: settings.step,
        pressAction: settings.pressAction,
        sessionMode: settings.sessionMode,
    };
    if (settings.sessionId)
        copy.sessionId = settings.sessionId;
    return copy;
}
//# sourceMappingURL=settings.js.map