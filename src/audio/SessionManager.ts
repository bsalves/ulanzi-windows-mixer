import { aggregateSessions, matchSessions, uniqueApplications } from "../session-match.js";
import type { AppQuery, AudioSession } from "../types.js";

export class SessionManager {
  constructor(private sessions: AudioSession[] = []) {}

  setSessions(sessions: AudioSession[]): void {
    this.sessions = sessions;
  }

  list(): AudioSession[] {
    return this.sessions;
  }

  applications() {
    return uniqueApplications(this.sessions);
  }

  find(query: AppQuery): AudioSession[] {
    return matchSessions(this.sessions, query);
  }

  state(query: AppQuery) {
    return aggregateSessions(this.find(query), query);
  }
}
