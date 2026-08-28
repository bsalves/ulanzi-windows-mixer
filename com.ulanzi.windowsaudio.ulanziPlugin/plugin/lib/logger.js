const LEVELS = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};
export class Logger {
    debugEnabled = false;
    host = null;
    attach(host) {
        this.host = host;
    }
    setDebug(enabled) {
        this.debugEnabled = enabled;
    }
    debug(message) {
        this.write("debug", message);
    }
    info(message) {
        this.write("info", message);
    }
    warn(message) {
        this.write("warn", message);
    }
    error(message) {
        this.write("error", message);
    }
    write(level, message) {
        if (level === "debug" && !this.debugEnabled)
            return;
        const line = `[${level.toUpperCase()}] ${message}`;
        if (this.host) {
            try {
                this.host.logMessage(line, level);
            }
            catch {
                // Host logging is best-effort.
            }
        }
        if (level === "error")
            console.error(line);
        else if (level === "warn")
            console.warn(line);
        else
            console.log(line);
    }
    isEnabled(level) {
        if (level === "debug")
            return this.debugEnabled;
        return LEVELS[level] >= LEVELS.info;
    }
}
export const logger = new Logger();
//# sourceMappingURL=logger.js.map