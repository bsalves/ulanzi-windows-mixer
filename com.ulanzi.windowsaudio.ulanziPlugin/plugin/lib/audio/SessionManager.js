import { aggregateSessions, matchSessions, uniqueApplications } from "../session-match.js";
export class SessionManager {
    sessions;
    constructor(sessions = []) {
        this.sessions = sessions;
    }
    setSessions(sessions) {
        this.sessions = sessions;
    }
    list() {
        return this.sessions;
    }
    applications() {
        return uniqueApplications(this.sessions);
    }
    find(query) {
        return matchSessions(this.sessions, query);
    }
    state(query) {
        return aggregateSessions(this.find(query), query);
    }
}
//# sourceMappingURL=SessionManager.js.map