/**
 * Device control is intentionally separate from per-application volume.
 * Future actions (input volume, output switching, routing) should use this
 * facade rather than mixing device selection into Application Volume.
 */
export class AudioDeviceManager {
    audio;
    constructor(audio) {
        this.audio = audio;
    }
    listPlayback() {
        return this.audio.listPlaybackDevices();
    }
    listCapture() {
        return this.audio.listCaptureDevices();
    }
}
//# sourceMappingURL=AudioDeviceManager.js.map