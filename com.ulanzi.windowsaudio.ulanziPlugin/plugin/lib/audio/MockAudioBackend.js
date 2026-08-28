import { EventEmitter } from "node:events";
import { aggregateSessions, matchSessions, uniqueApplications } from "../session-match.js";
import { applyStep, clampVolume, shouldUnmuteOnAdjust } from "../volume.js";
export class MockAudioBackend extends EventEmitter {
    sessions = [];
    master = { volume: 0.5, muted: false };
    lastKnown = new Map();
    connected = false;
    devices = [
        { id: "default-render", name: "Speakers", flow: "render", isDefault: true },
        { id: "default-capture", name: "Microphone", flow: "capture", isDefault: true },
    ];
    constructor(initial = []) {
        super();
        this.sessions = initial.map((session) => ({ ...session }));
    }
    async start() {
        this.connected = true;
        this.emit("helperStatus", { connected: true });
        this.emit("sessionsChanged", this.snapshot());
        this.emit("masterChanged", { ...this.master });
    }
    async stop() {
        this.connected = false;
        this.emit("helperStatus", { connected: false });
    }
    isConnected() {
        return this.connected;
    }
    setSessions(sessions) {
        this.sessions = sessions.map((session) => ({ ...session }));
        this.emit("sessionsChanged", this.snapshot());
    }
    addSession(session) {
        this.sessions.push({ ...session });
        this.emit("sessionsChanged", this.snapshot());
    }
    removeByExecutable(executable) {
        this.sessions = this.sessions.filter((session) => session.executable.toLowerCase() !== executable.toLowerCase());
        this.emit("sessionsChanged", this.snapshot());
    }
    async listSessions() {
        return this.snapshot();
    }
    async listDevices(flow) {
        return this.devices.filter((device) => !flow || device.flow === flow);
    }
    async getMaster() {
        return { ...this.master };
    }
    async setMasterVolume(volume) {
        this.master.volume = clampVolume(volume);
        if (this.master.volume > 0)
            this.master.muted = false;
        this.emit("masterChanged", { ...this.master });
        return { ...this.master };
    }
    async setMasterMute(muted) {
        this.master.muted = muted;
        this.emit("masterChanged", { ...this.master });
        return { ...this.master };
    }
    async toggleMasterMute() {
        return this.setMasterMute(!this.master.muted);
    }
    async adjustMasterVolume(delta) {
        const step = Math.round(Math.abs(delta) * 100) || 2;
        const direction = delta >= 0 ? 1 : -1;
        const next = applyStep(this.master.volume, direction, step);
        if (shouldUnmuteOnAdjust(this.master, next))
            this.master.muted = false;
        return this.setMasterVolume(next);
    }
    async getApp(query) {
        return this.appState(query);
    }
    async setAppVolume(query, volume) {
        const matched = matchSessions(this.sessions, query);
        const next = clampVolume(volume);
        for (const session of matched) {
            session.volume = next;
            if (next > 0)
                session.muted = false;
        }
        const state = this.appState(query);
        this.lastKnown.set(query.executable.toLowerCase(), { volume: state.volume, muted: state.muted });
        this.emit("appChanged", state);
        this.emit("sessionsChanged", this.snapshot());
        return state;
    }
    async setAppMute(query, muted) {
        const matched = matchSessions(this.sessions, query);
        for (const session of matched)
            session.muted = muted;
        const state = this.appState(query);
        this.lastKnown.set(query.executable.toLowerCase(), { volume: state.volume, muted: state.muted });
        this.emit("appChanged", state);
        this.emit("sessionsChanged", this.snapshot());
        return state;
    }
    async toggleAppMute(query) {
        const current = this.appState(query);
        return this.setAppMute(query, !current.muted);
    }
    async adjustAppVolume(query, delta) {
        const current = this.appState(query);
        const step = Math.round(Math.abs(delta) * 100) || 2;
        const direction = delta >= 0 ? 1 : -1;
        const next = applyStep(current.volume, direction, step);
        if (shouldUnmuteOnAdjust(current, next)) {
            await this.setAppMute(query, false);
        }
        return this.setAppVolume(query, next);
    }
    applications() {
        return uniqueApplications(this.sessions);
    }
    appState(query) {
        const matched = matchSessions(this.sessions, query);
        return aggregateSessions(matched, query, this.lastKnown.get(query.executable.toLowerCase()));
    }
    snapshot() {
        return this.sessions.map((session) => ({ ...session }));
    }
}
//# sourceMappingURL=MockAudioBackend.js.map