export class DiagnosticError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = "DiagnosticError";
    this.code = code;
    this.details = details;
  }
}
export function fail(code, message, details = {}) { throw new DiagnosticError(code, message, details); }
export function diagnosticOf(error) {
  if (error instanceof DiagnosticError) return { code: error.code, message: error.message, ...error.details };
  return { code: "P09_INTERNAL", message: error instanceof Error ? error.message : String(error) };
}
