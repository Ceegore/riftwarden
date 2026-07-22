export const HUMAN_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.css', '.scss', '.html', '.json', '.jsonc', '.md',
  '.java', '.kt', '.kts', '.swift', '.plist', '.xml',
  '.yml', '.yaml', '.sh', '.ps1',
]);

export const GENERATED_PREFIXES = Object.freeze([
  'content/generated/',
  'public/assets/generated/',
  'docs/reports/generated/',
]);

export const GENERATED_CONTRACT_MARKER = 'GENERATED_DIRECTORY_CONTRACT';

export const WARN_AT = 301;
export const FAIL_AT = 501;

/**
 * Normalizes a path to POSIX form and strips a leading ./.
 * @param {string} value Input path.
 * @returns {string}
 */
export function toPosix(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '');
}

/**
 * Checks whether the given path is inside a generated directory.
 * @param {string} path Relative path.
 * @returns {boolean}
 */
export function isGeneratedPath(path) {
  const normalized = toPosix(path);
  return GENERATED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
