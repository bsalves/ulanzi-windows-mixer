import { uniqueApplications } from "../session-match.js";
export class ApplicationScanner {
    audio;
    constructor(audio) {
        this.audio = audio;
    }
    async list() {
        const sessions = await this.audio.listSessions();
        return uniqueApplications(sessions);
    }
}
//# sourceMappingURL=ApplicationScanner.js.map