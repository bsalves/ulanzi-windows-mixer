import type { StepPercent, VolumeState } from "./types.js";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, 0, 1);
}

export function toPercent(volume: number): number {
  return Math.round(clampVolume(volume) * 100);
}

export function fromPercent(percent: number): number {
  return clampVolume(percent / 100);
}

export function applyStep(
  currentVolume: number,
  direction: 1 | -1,
  stepPercent: StepPercent,
): number {
  const current = toPercent(currentVolume);
  const next = clamp(current + direction * stepPercent, 0, 100);
  return fromPercent(next);
}

export function volumeAfterUnmute(
  state: VolumeState,
  fallback = 0.5,
): number {
  if (state.muted) {
    return state.volume > 0 ? state.volume : fallback;
  }
  return state.volume;
}

export function shouldUnmuteOnAdjust(state: VolumeState, nextVolume: number): boolean {
  return state.muted && nextVolume > 0;
}
