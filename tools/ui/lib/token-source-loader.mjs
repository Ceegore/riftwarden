import { readFile } from 'node:fs/promises';
import { parseStrictJson } from './strict-json.mjs';

const PARSE_CODE_MAP = new Map([
  ['L10N_JSON_DUPLICATE_KEY', 'P07_TOKEN_DUPLICATE_KEY'],
  ['L10N_JSON_FORBIDDEN_CONTROL', 'P07_TOKEN_JSON_INVALID'],
  ['L10N_SOURCE_SCHEMA', 'P07_TOKEN_JSON_INVALID'],
]);

export function parseTokenSource(text, sourcePath = '<memory>') {
  try {
    return parseStrictJson(text, sourcePath);
  } catch (error) {
    const mapped = PARSE_CODE_MAP.get(error?.code) ?? 'P07_TOKEN_JSON_INVALID';
    const wrapped = new Error(error instanceof Error ? error.message : String(error));
    wrapped.code = mapped;
    wrapped.cause = error;
    wrapped.sourcePath = sourcePath;
    throw wrapped;
  }
}

export async function loadTokenSource(sourcePath) {
  return parseTokenSource(await readFile(sourcePath, 'utf8'), sourcePath);
}
