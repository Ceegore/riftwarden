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
  'docs/requirements/generated/',
  'docs/requirements/requirements/_staging/',
  'docs/requirements/requirements/',
  'docs/requirements/normalization-ledger/',
  'docs/requirements/chapter-dispositions/',
  'docs/requirements/source-headings/',
  'docs/requirements/schemas/',
]);

// Individual generated files (not prefixes) that bypass the line gate.
// These are tool-generated artifacts, not human-maintained source.
export const GENERATED_FILES = Object.freeze([
  'pnpm-lock.yaml',
  'docs/reports/toolchain-freeze.json',
  'docs/reports/license-inventory.json',
  'docs/reports/build-dev-hashes.json',
  'docs/reports/build-qa-hashes.json',
  'docs/reports/build-release-hashes.json',
  'docs/reports/postinstall-audit.json',
  'docs/reports/native-toolchains.json',
  'docs/requirements/tests.json',
  'docs/requirements/traceability.json',
  'docs/requirements/source-findings.json',
  'docs/requirements/source-manifest.json',
  'docs/requirements/normalization-ledger.json',
  'docs/requirements/external-decisions.json',
  'docs/requirements/chapter-dispositions.json',
  'docs/requirements/source-headings.json',
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
  return GENERATED_PREFIXES.some((prefix) => normalized.startsWith(prefix))
    || GENERATED_FILES.includes(normalized);
}
