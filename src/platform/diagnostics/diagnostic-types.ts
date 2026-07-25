export type SafeDiagnosticContext = Readonly<
  Record<string, string | number | boolean>
>;

export interface DiagnosticEntry {
  readonly utc: string;
  readonly appVersion: string;
  readonly buildChannel: 'dev' | 'qa' | 'release';
  readonly platform: 'web' | 'android' | 'ios';
  readonly osVersion: string;
  readonly errorCode: string;
  readonly module: string;
  readonly safeContext: SafeDiagnosticContext;
  readonly stack?: string;
}

export interface DiagnosticSession {
  readonly sessionId: string;
  readonly startedAtUtc: string;
  readonly entries: readonly DiagnosticEntry[];
  readonly byteLength: number;
}

export interface DiagnosticStore {
  readSessions(): Promise<readonly DiagnosticSession[]>;
  replaceSessions(sessions: readonly DiagnosticSession[]): Promise<void>;
}

export interface DiagnosticHealth {
  readonly appendFailures: number;
  readonly droppedEntries: number;
}
