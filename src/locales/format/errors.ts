export type LocaleRuntimeErrorCode =
  | 'L10N_RUNTIME_MISSING_KEY'
  | 'L10N_RUNTIME_MISSING_PARAMETER'
  | 'L10N_RUNTIME_EXTRA_PARAMETER'
  | 'L10N_RUNTIME_PARAMETER_TYPE'
  | 'L10N_RUNTIME_INVALID_LOCALE'
  | 'L10N_RUNTIME_INVALID_BUNDLE'
  | 'L10N_RUNTIME_RICH_TEXT_REQUIRED';

export class LocaleRuntimeError extends Error {
  readonly code: LocaleRuntimeErrorCode;
  readonly key: string | undefined;
  readonly parameter: string | undefined;

  constructor(code:LocaleRuntimeErrorCode, message:string, details:Readonly<{ key?:string; parameter?:string }> = {}) {
    super(message);
    this.name = 'LocaleRuntimeError';
    this.code = code;
    this.key = details.key;
    this.parameter = details.parameter;
  }
}
