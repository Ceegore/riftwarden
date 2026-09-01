/**
 * Closed error-code union for the Phase 30 app-shell pure layer. Invalid route
 * resolution, settings commits against a stale baseline, refused external
 * links, malformed HQ registries and double-fired idempotent actions throw an
 * AppShellError with one of these codes; validation findings that are
 * presentation concerns (unknown enum values, blocked screens) are results,
 * not exceptions.
 */
export type AppShellErrorCode =
  | 'UNKNOWN_ROUTE_ID'
  | 'STALE_SETTINGS_BASELINE'
  | 'INVALID_SETTINGS_VALUE'
  | 'LINK_SCHEME_REFUSED'
  | 'LINK_HOST_REFUSED'
  | 'LINK_PLACEHOLDER_REFUSED'
  | 'HQ_AREA_COUNT'
  | 'HQ_AREA_DUPLICATE'
  | 'HQ_AREA_LOCKED_WITHOUT_REASON'
  | 'HQ_AREA_MISSING_ROUTE'
  | 'ACTION_ALREADY_RUN'
  | 'CONTINUE_UNKNOWN_SAVE_CLASS';

export class AppShellError extends Error {
  readonly code: AppShellErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: AppShellErrorCode, details: Readonly<Record<string, unknown>> = {}) {
    super(`app-shell.${code}`);
    this.name = 'AppShellError';
    this.code = code;
    this.details = details;
  }
}
