import type { AudioSession } from "../types.js";
import { uniqueApplications } from "../session-match.js";
import type { AudioManager } from "./AudioManager.js";

export class ApplicationScanner {
  constructor(private readonly audio: AudioManager) {}

  async list() {
    const sessions: AudioSession[] = await this.audio.listSessions();
    return uniqueApplications(sessions);
  }
}
