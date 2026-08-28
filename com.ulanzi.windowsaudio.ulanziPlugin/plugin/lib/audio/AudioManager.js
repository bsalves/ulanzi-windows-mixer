import { EventEmitter } from "node:events";
import { uniqueApplications } from "../session-match.js";
import { logger } from "../logger.js";
/**
 * High-level audio facade used by Ulanzi actions.
 * Device enumeration is exposed for future input/output routing actions
 * and is intentionally not mixed into application volume control.
 */
export class AudioManager extends EventEmitter {
    backend;
    constructor(backend) {
        super();
        this.backend = backend;
        this.backend.on("sessionsChanged", (sessions) => {
            this.emit("sessionsChanged", sessions);
        });
        this.backend.on("masterChanged", (state) => this.emit("masterChanged", state));
        this.backend.on("appChanged", (state) => this.emit("appChanged", state));
        this.backend.on("helperStatus", (status) => this.emit("helperStatus", status));
    }
    async start() {
        await this.backend.start();
    }
    async stop() {
        await this.backend.stop();
    }
    isConnected() {
        return this.backend.isConnected();
    }
    async listApplications() {
        const sessions = await this.safe("listSessions", () => this.backend.listSessions(), []);
        return uniqueApplications(sessions);
    }
    async listSessions() {
        return this.safe("listSessions", () => this.backend.listSessions(), []);
    }
    async listPlaybackDevices() {
        return this.safe("listDevices", () => this.backend.listDevices("render"), []);
    }
    async listCaptureDevices() {
        return this.safe("listDevices", () => this.backend.listDevices("capture"), []);
    }
    getVolume(kind, query) {
        if (kind === "master")
            return this.backend.getMaster();
        return this.backend.getApp(query);
    }
    setVolume(kind, volume, query) {
        if (kind === "master")
            return this.backend.setMasterVolume(volume);
        return this.backend.setAppVolume(query, volume);
    }
    increaseVolume(kind, stepPercent, query) {
        const delta = stepPercent / 100;
        if (kind === "master")
            return this.backend.adjustMasterVolume(delta);
        return this.backend.adjustAppVolume(query, delta);
    }
    decreaseVolume(kind, stepPercent, query) {
        const delta = -(stepPercent / 100);
        if (kind === "master")
            return this.backend.adjustMasterVolume(delta);
        return this.backend.adjustAppVolume(query, delta);
    }
    toggleMute(kind, query) {
        if (kind === "master")
            return this.backend.toggleMasterMute();
        return this.backend.toggleAppMute(query);
    }
    async getMuteState(kind, query) {
        if (kind === "master")
            return (await this.backend.getMaster()).muted;
        return (await this.backend.getApp(query)).muted;
    }
    async safe(name, fn, fallback) {
        try {
            return await fn();
        }
        catch (error) {
            logger.warn(`${name} failed: ${error instanceof Error ? error.message : String(error)}`);
            return fallback;
        }
    }
}
//# sourceMappingURL=AudioManager.js.map