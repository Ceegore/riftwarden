import type { SafeDiagnosticContext } from './diagnostic-types';

const FORBIDDEN_KEY_PATTERN =
  /(user|name|email|phone|address|token|secret|password|device.?id|android.?id|idfv|advert|ip|path|save|replay|payload)/i;

const MAX_KEYS = 24;
const MAX_STRING_LENGTH = 160;

export function sanitizeDiagnosticContext(
  input: Readonly<Record<string, unknown>>,
): SafeDiagnosticContext {
  const output: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(input).slice(0, MAX_KEYS)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) {
      continue;
    }

    if (typeof value === 'string') {
      output[key] = value.slice(0, MAX_STRING_LENGTH);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      output[key] = value;
    } else if (typeof value === 'boolean') {
      output[key] = value;
    }
  }

  return output;
}
