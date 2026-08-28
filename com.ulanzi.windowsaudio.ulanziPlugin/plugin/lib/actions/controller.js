import { logger } from "../logger.js";
import { normalizeSettings, persistableSettings, settingsFromActionUuid, } from "../settings.js";
import { isMasterAction, queryFromSettings, viewFromApp, viewFromMaster, } from "./common.js";
export class ActionController {
    host;
    audio;
    display;
    actions = new Map();
    inspectors = new Set();
    renderQueue = new Map();
    lastPressAt = new Map();
    constructor(host, audio, display) {
        this.host = host;
        this.audio = audio;
        this.display = display;
    }
    bind() {
        this.audio.on("sessionsChanged", (sessions) => {
            void this.onSessionsChanged(sessions);
        });
        this.audio.on("masterChanged", (state) => {
            void this.onMasterChanged(state);
        });
        this.audio.on("appChanged", (state) => {
            void this.onAppChanged(state);
        });
        this.audio.on("helperStatus", (status) => {
            if (!status.connected) {
                for (const [context, action] of this.actions) {
                    this.display.render(context, {
                        title: action.kind === "master" ? "SYSTEM" : action.settings.displayName || "APP",
                        percent: 0,
                        muted: false,
                        waiting: false,
                        error: "No helper",
                    });
                }
            }
            else {
                void this.refreshAll();
            }
            this.pushApplicationsToInspectors();
        });
    }
    upsert(context, raw, uuid = "") {
        const fallback = isMasterAction(uuid) ? "master" : "application";
        const fromUuid = uuid ? settingsFromActionUuid(uuid) : settingsFromActionUuid(".application");
        const settings = normalizeSettings(raw, fallback);
        if (fromUuid.mode === "master")
            settings.mode = "master";
        const action = {
            context,
            settings,
            kind: settings.mode === "master" ? "master" : "application",
        };
        this.actions.set(context, action);
        void this.refresh(context);
        return action;
    }
    remove(context) {
        this.actions.delete(context);
        this.inspectors.delete(context);
    }
    get(context) {
        return this.actions.get(context);
    }
    async rotate(context, direction) {
        const action = this.actions.get(context);
        if (!action)
            return;
        try {
            if (action.kind === "master") {
                if (direction > 0)
                    await this.audio.increaseVolume("master", action.settings.step);
                else
                    await this.audio.decreaseVolume("master", action.settings.step);
            }
            else {
                if (!action.settings.executable)
                    return this.display.alert(context);
                const query = queryFromSettings(action.settings);
                if (direction > 0)
                    await this.audio.increaseVolume("application", action.settings.step, query);
                else
                    await this.audio.decreaseVolume("application", action.settings.step, query);
            }
            await this.refresh(context);
        }
        catch (error) {
            logger.error(`rotate failed: ${error instanceof Error ? error.message : String(error)}`);
            this.display.alert(context);
        }
    }
    async press(context) {
        const now = Date.now();
        const last = this.lastPressAt.get(context) ?? 0;
        if (now - last < 200)
            return;
        this.lastPressAt.set(context, now);
        const action = this.actions.get(context);
        if (!action)
            return;
        try {
            if (action.settings.pressAction === "volumeUp") {
                await this.rotate(context, 1);
                return;
            }
            if (action.settings.pressAction === "volumeDown") {
                await this.rotate(context, -1);
                return;
            }
            if (action.kind === "master") {
                await this.audio.toggleMute("master");
            }
            else {
                if (!action.settings.executable)
                    return this.display.alert(context);
                await this.audio.toggleMute("application", queryFromSettings(action.settings));
            }
            await this.refresh(context);
        }
        catch (error) {
            logger.error(`press failed: ${error instanceof Error ? error.message : String(error)}`);
            this.display.alert(context);
        }
    }
    async refresh(context) {
        const pending = this.renderQueue.get(context) ?? Promise.resolve();
        const next = pending.then(() => this.refreshNow(context)).catch((error) => {
            logger.warn(`refresh failed: ${error instanceof Error ? error.message : String(error)}`);
        });
        this.renderQueue.set(context, next);
        await next;
    }
    async refreshAll() {
        await Promise.all([...this.actions.keys()].map((context) => this.refresh(context)));
    }
    inspectorOpened(context) {
        this.inspectors.add(context);
        this.pushApplications(context);
    }
    async refreshNow(context) {
        const action = this.actions.get(context);
        if (!action)
            return;
        try {
            if (action.kind === "master") {
                const state = await this.audio.getVolume("master");
                this.display.render(context, viewFromMaster(state, action.settings));
                return;
            }
            if (!action.settings.executable) {
                this.display.render(context, {
                    title: "APP",
                    percent: 0,
                    muted: false,
                    waiting: true,
                });
                return;
            }
            const state = await this.audio.getVolume("application", queryFromSettings(action.settings));
            if (state.displayName && state.displayName !== action.settings.displayName) {
                action.settings.displayName = state.displayName;
            }
            this.display.render(context, viewFromApp(state, action.settings));
        }
        catch (error) {
            logger.warn(`display refresh failed: ${error instanceof Error ? error.message : String(error)}`);
            this.display.render(context, {
                title: action.kind === "master" ? "SYSTEM" : action.settings.displayName || "APP",
                percent: 0,
                muted: false,
                waiting: false,
                error: "Error",
            });
        }
    }
    async onSessionsChanged(_sessions) {
        await this.refreshAll();
        this.pushApplicationsToInspectors();
    }
    async onMasterChanged(_state) {
        await Promise.all([...this.actions.entries()]
            .filter(([, action]) => action.kind === "master")
            .map(([context]) => this.refresh(context)));
    }
    async onAppChanged(state) {
        await Promise.all([...this.actions.entries()]
            .filter(([, action]) => {
            if (action.kind !== "application")
                return false;
            return action.settings.executable.toLowerCase() === state.executable.toLowerCase();
        })
            .map(([context]) => this.refresh(context)));
    }
    async pushApplicationsToInspectors() {
        await Promise.all([...this.inspectors].map((context) => this.pushApplications(context)));
    }
    async pushApplications(context) {
        const applications = await this.audio.listApplications();
        const action = this.actions.get(context);
        this.host.sendToPropertyInspector({
            type: "applications",
            applications,
            settings: action ? persistableSettings(action.settings) : undefined,
            helperConnected: this.audio.isConnected(),
        }, context);
    }
    saveFromInspector(context, raw, uuid) {
        const action = this.upsert(context, raw, uuid);
        this.host.setSettings(persistableSettings(action.settings), context);
    }
}
export function payloadOf(message) {
    return (message.payload || message.param || message.settings || {});
}
//# sourceMappingURL=controller.js.map