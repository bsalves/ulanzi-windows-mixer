export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
export function clampVolume(value) {
    if (!Number.isFinite(value))
        return 0;
    return clamp(value, 0, 1);
}
export function toPercent(volume) {
    return Math.round(clampVolume(volume) * 100);
}
export function fromPercent(percent) {
    return clampVolume(percent / 100);
}
export function applyStep(currentVolume, direction, stepPercent) {
    const current = toPercent(currentVolume);
    const next = clamp(current + direction * stepPercent, 0, 100);
    return fromPercent(next);
}
export function volumeAfterUnmute(state, fallback = 0.5) {
    if (state.muted) {
        return state.volume > 0 ? state.volume : fallback;
    }
    return state.volume;
}
export function shouldUnmuteOnAdjust(state, nextVolume) {
    return state.muted && nextVolume > 0;
}
//# sourceMappingURL=volume.js.map