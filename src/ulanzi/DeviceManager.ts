/**
 * Reserved for future encoder/keypad disconnect handling.
 * Ulanzi Studio delivers per-action clear/setActive events; there is no
 * documented device-disconnect callback in protocol V3.1.0. When an action is
 * cleared we drop its context in ActionController.remove().
 */
export class DeviceManager {
  private active = new Set<string>();

  setActive(context: string, active: boolean): void {
    if (active) this.active.add(context);
    else this.active.delete(context);
  }

  isActive(context: string): boolean {
    return this.active.has(context);
  }

  clear(context: string): void {
    this.active.delete(context);
  }
}
