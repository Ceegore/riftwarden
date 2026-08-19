export type HudErrorCode = 'INVALID_SPEED' | 'INVALID_TICK_INPUT' | 'INVALID_ANNOUNCEMENT';

export type HudDiagnosticDetails = Readonly<Record<string, string | number | boolean>>;

export class HudError extends Error {
  readonly code: HudErrorCode;
  readonly details: HudDiagnosticDetails;

  constructor(code: HudErrorCode, details: HudDiagnosticDetails = {}) {
    super(code);
    this.name = 'HudError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
