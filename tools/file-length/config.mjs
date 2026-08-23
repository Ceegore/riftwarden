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
  'docs/reports/content-ledger/',
  'docs/requirements/generated/',
  'docs/requirements/requirements/_staging/',
  'docs/requirements/requirements/',
  'docs/requirements/normalization-ledger/',
  'docs/requirements/chapter-dispositions/',
  'docs/requirements/source-headings/',
  'docs/requirements/schemas/',
  'tests/locales/fixtures/',
  'src/locales/generated/',
  'src/ui/tokens/generated/',
  'src/screens/dev/',
  'src/app/navigation/generated/',
  'tests/navigation/fixtures/',
  'inputs/sources/',
  'contracts/rules/',
  'contracts/math/',
  'contracts/random/',
  'contracts/sim/',
  'contracts/phase32/fixtures/',
]);

// Individual generated files (not prefixes) that bypass the line gate.
// These are tool-generated artifacts, not human-maintained source.
export const GENERATED_FILES = Object.freeze([
  'pnpm-lock.yaml',
  'src/app/navigation/screen-registry.source.json',
  'src/app/navigation/screen-alias-resolution.source.json',
  'docs/reports/toolchain-freeze.json',
  'docs/reports/license-inventory.json',
  'docs/reports/build-dev-hashes.json',
  'docs/reports/build-qa-hashes.json',
  'docs/reports/build-release-hashes.json',
  'docs/reports/postinstall-audit.json',
  'docs/reports/native-toolchains.json',
  'docs/reports/phase14-crossruntime.json',
  'docs/requirements/tests.json',
  'docs/requirements/traceability.json',
  'docs/requirements/source-findings.json',
  'docs/requirements/source-manifest.json',
  'docs/requirements/normalization-ledger.json',
  'docs/requirements/external-decisions.json',
  'docs/requirements/chapter-dispositions.json',
  'docs/requirements/source-headings.json',
  'contracts/phase32/golden-registry.json',
  'contracts/phase32/map-qa-report.json',
  'src/locales/format/bootstrap-bundle.ts',
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
