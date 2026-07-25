import type {
  DiagnosticSession,
  DiagnosticStore,
} from './diagnostic-types';

export class MemoryDiagnosticStore implements DiagnosticStore {
  private sessions: readonly DiagnosticSession[] = [];

  public readSessions(): Promise<readonly DiagnosticSession[]> {
    return Promise.resolve(structuredClone(this.sessions));
  }

  public replaceSessions(
    sessions: readonly DiagnosticSession[],
  ): Promise<void> {
    this.sessions = structuredClone(sessions);
    return Promise.resolve();
  }
}
