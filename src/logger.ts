import type { LogLevel, UlanziHost } from "./types.js";

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  private debugEnabled = false;
  private host: UlanziHost | null = null;

  attach(host: UlanziHost): void {
    this.host = host;
  }

  setDebug(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  debug(message: string): void {
    this.write("debug", message);
  }

  info(message: string): void {
    this.write("info", message);
  }

  warn(message: string): void {
    this.write("warn", message);
  }

  error(message: string): void {
    this.write("error", message);
  }

  private write(level: LogLevel, message: string): void {
    if (level === "debug" && !this.debugEnabled) return;
    const line = `[${level.toUpperCase()}] ${message}`;
    if (this.host) {
      try {
        this.host.logMessage(line, level);
      } catch {
        // Host logging is best-effort.
      }
    }
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  isEnabled(level: LogLevel): boolean {
    if (level === "debug") return this.debugEnabled;
    return LEVELS[level] >= LEVELS.info;
  }
}

export const logger = new Logger();
