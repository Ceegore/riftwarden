export class NavigationDiagnostic extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NavigationDiagnostic';
    this.code = code;
    this.details = details;
  }
}
export function fail(code, message, details = {}) {
  throw new NavigationDiagnostic(code, message, details);
}
export function asDiagnostic(error, fallbackCode = 'NAV_RELEASE_BLOCKED') {
  if (error instanceof NavigationDiagnostic) return error;
  return new NavigationDiagnostic(fallbackCode, String(error));
}
