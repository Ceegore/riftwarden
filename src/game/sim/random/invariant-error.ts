export type RandomDiagnosticDetails = Readonly<Record<string, string | number | boolean>>;

export class RandomInvariantError extends Error {
  readonly code: string;
  readonly details: RandomDiagnosticDetails;

  constructor(code: string, details: RandomDiagnosticDetails = {}) {
    super(code);
    this.name = 'RandomInvariantError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
