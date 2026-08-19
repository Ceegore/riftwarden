import type { JsonValue } from '../canonical-json.js';
import type { RecoveryReason } from '../schema/types.js';

export interface DiagnosticReport {
  readonly appVersion: string;
  readonly schemaVersions: Readonly<{ readonly profile: number; readonly run: number; readonly settings: number }>;
  readonly contentVersion: string;
  readonly simulationVersion: string;
  readonly slotIntegrity: Readonly<Record<string, 'valid' | 'invalid' | 'missing'>>;
  readonly recoveryDecisions: readonly RecoveryReason[];
  readonly rendererAvailable: boolean;
  readonly errorCodes: readonly string[];
}

export const DIAGNOSTIC_KEYS = [
  'appVersion',
  'schemaVersions',
  'contentVersion',
  'simulationVersion',
  'slotIntegrity',
  'recoveryDecisions',
  'rendererAvailable',
  'errorCodes',
] as const;

/**
 * Opt-in diagnostics export with minimized data: app/schema/content/
 * simulation versions, slot integrity, recovery decisions, renderer
 * capability and stable error codes. Personal data, free file paths, device
 * identifiers and payload contents are excluded. Logs and replays are only
 * included through an explicit separate selection.
 */
export function buildDiagnostic(report: DiagnosticReport): JsonValue {
  return {
    appVersion: report.appVersion,
    schemaVersions: report.schemaVersions,
    contentVersion: report.contentVersion,
    simulationVersion: report.simulationVersion,
    slotIntegrity: report.slotIntegrity,
    recoveryDecisions: report.recoveryDecisions,
    rendererAvailable: report.rendererAvailable,
    errorCodes: report.errorCodes,
  };
}

export function isDiagnosticKey(key: string): boolean {
  return (DIAGNOSTIC_KEYS as readonly string[]).includes(key);
}
