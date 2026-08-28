/**
 * Reserved for future encoder/keypad disconnect handling.
 * Ulanzi Studio delivers per-action clear/setActive events; there is no
 * documented device-disconnect callback in protocol V3.1.0. When an action is
 * cleared we drop its context in ActionController.remove().
 */
export class DeviceManager {
    active = new Set();
    setActive(context, active) {
        if (active)
            this.active.add(context);
        else
            this.active.delete(context);
    }
    isActive(context) {
        return this.active.has(context);
    }
    clear(context) {
        this.active.delete(context);
    }
}
//# sourceMappingURL=DeviceManager.js.map