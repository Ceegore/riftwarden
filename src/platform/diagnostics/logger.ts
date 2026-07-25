import { sanitizeDiagnosticContext } from './safe-context';
import type {
  DiagnosticEntry,
  DiagnosticHealth,
  DiagnosticSession,
  DiagnosticStore,
} from './diagnostic-types';

const MAX_SESSIONS = 5;
const MAX_SESSION_BYTES = 512 * 1024;
const MAX_TOTAL_BYTES = 2.5 * 1024 * 1024;

export interface DiagnosticLoggerOptions {
  readonly appVersion: string;
  readonly buildChannel: 'dev' | 'qa' | 'release';
  readonly platform: 'web' | 'android' | 'ios';
  readonly osVersion: string;
  readonly sessionId: string;
  readonly startedAtUtc: string;
  readonly nowUtc: () => string;
}

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function normalizeSession(session: DiagnosticSession): DiagnosticSession {
  const entries = [...session.entries];
  while (entries.length > 0 && byteLength(entries) > MAX_SESSION_BYTES) {
    entries.shift();
  }
  return {
    ...session,
    entries,
    byteLength: byteLength(entries),
  };
}

function rotateSessions(
  sessions: readonly DiagnosticSession[],
): readonly DiagnosticSession[] {
  const kept = [...sessions].slice(-MAX_SESSIONS);
  while (
    kept.length > 0 &&
    kept.reduce((sum, session) => sum + session.byteLength, 0) >
      MAX_TOTAL_BYTES
  ) {
    kept.shift();
  }
  return kept;
}

export class DiagnosticLogger {
  private appendFailures = 0;
  private droppedEntries = 0;

  public constructor(
    private readonly store: DiagnosticStore,
    private readonly options: DiagnosticLoggerOptions,
  ) {}

  public getHealth(): DiagnosticHealth {
    return {
      appendFailures: this.appendFailures,
      droppedEntries: this.droppedEntries,
    };
  }

  public async record(
    errorCode: string,
    module: string,
    context: Readonly<Record<string, unknown>>,
    stack?: string,
  ): Promise<void> {
    try {
      const entry: DiagnosticEntry = {
        utc: this.options.nowUtc(),
        appVersion: this.options.appVersion,
        buildChannel: this.options.buildChannel,
        platform: this.options.platform,
        osVersion: this.options.osVersion,
        errorCode,
        module,
        safeContext: sanitizeDiagnosticContext(context),
        ...(stack === undefined ? {} : { stack: stack.slice(0, 8_192) }),
      };

      const sessions = [...(await this.store.readSessions())];
      const existingIndex = sessions.findIndex(
        (session) => session.sessionId === this.options.sessionId,
      );
      const existing: DiagnosticSession =
        existingIndex >= 0 && sessions[existingIndex] !== undefined
          ? sessions[existingIndex]
          : {
              sessionId: this.options.sessionId,
              startedAtUtc: this.options.startedAtUtc,
              entries: [],
              byteLength: 0,
            };

      const candidate = normalizeSession({
        sessionId: existing.sessionId,
        startedAtUtc: existing.startedAtUtc,
        entries: [...existing.entries, entry],
        byteLength: 0,
      });

      if (candidate.entries.length === existing.entries.length) {
        this.droppedEntries += 1;
      }

      if (existingIndex >= 0) {
        sessions[existingIndex] = candidate;
      } else {
        sessions.push(candidate);
      }

      await this.store.replaceSessions(rotateSessions(sessions));
    } catch {
      this.appendFailures += 1;
    }
  }
}
