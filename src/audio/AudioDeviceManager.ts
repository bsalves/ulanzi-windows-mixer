import type { AudioDevice } from "../types.js";
import type { AudioManager } from "./AudioManager.js";

/**
 * Device control is intentionally separate from per-application volume.
 * Future actions (input volume, output switching, routing) should use this
 * facade rather than mixing device selection into Application Volume.
 */
export class AudioDeviceManager {
  constructor(private readonly audio: AudioManager) {}

  listPlayback(): Promise<AudioDevice[]> {
    return this.audio.listPlaybackDevices();
  }

  listCapture(): Promise<AudioDevice[]> {
    return this.audio.listCaptureDevices();
  }
}
