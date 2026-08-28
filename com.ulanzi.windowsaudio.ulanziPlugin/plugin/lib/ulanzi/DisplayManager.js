import { buildVolumeIconSvg, formatEncoderTitle, formatKeypadText, svgToDataUri, } from "../display.js";
import { logger } from "../logger.js";
/**
 * Encoder feedback uses the documented built-in layout `$UA1` (icon + title).
 * Custom layout files are not supported by Ulanzi protocol V3.1.0.
 * Keypad keys use setStateIcon overlay text.
 */
export class DisplayManager {
    host;
    constructor(host) {
        this.host = host;
    }
    render(context, view) {
        const title = formatEncoderTitle(view);
        const keypad = formatKeypadText(view);
        const state = view.muted || Boolean(view.error) ? 1 : 0;
        const icon = svgToDataUri(buildVolumeIconSvg(view));
        try {
            this.host.setStateIcon(context, state, keypad);
        }
        catch (error) {
            logger.debug(`setStateIcon failed: ${String(error)}`);
        }
        try {
            this.host.setTitle(context, view.waiting ? "Waiting for audio..." : `${view.title}\n${title}`);
        }
        catch (error) {
            logger.debug(`setTitle failed: ${String(error)}`);
        }
        try {
            this.host.setFeedbackLayout(context, "$UA1");
            this.host.setFeedback(context, {
                title: { text: `${view.title}\n${title}` },
                icon: { value: icon },
            });
        }
        catch (error) {
            logger.debug(`setFeedback failed: ${String(error)}`);
        }
    }
    alert(context) {
        try {
            this.host.showAlert(context);
        }
        catch {
            // ignore
        }
    }
}
//# sourceMappingURL=DisplayManager.js.map