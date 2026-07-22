export const REQUIRED_DIRECTORIES = Object.freeze([
  'src/app',
  'src/screens',
  'src/features',
  'src/game/rules',
  'src/game/sim',
  'src/game/content',
  'src/game/render',
  'src/game/replay',
  'src/ui',
  'src/audio',
  'src/storage',
  'src/platform',
  'src/locales',
  'content/source',
  'content/schemas',
  'content/generated',
  'assets/source',
  'assets/manifest',
  'public/assets/generated',
  'tools',
  'tests/unit',
  'tests/simulation',
  'tests/integration',
  'tests/e2e',
  'tests/visual',
  'tests/fixtures',
  'android',
  'ios',
  'docs/adr',
  'docs/reports',
  'docs/requirements',
  'docs/qa',
  'docs/release',
  'store/android',
  'store/ios',
]);

export const REQUIRED_FILES = Object.freeze([
  'package.json',
  '.node-version',
  '.npmrc',
  '.editorconfig',
  '.gitattributes',
  '.gitignore',
  'CONTRIBUTING.md',
  'SECURITY.md',
  '.github/CODEOWNERS',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/workflows/phase01-governance.yml',
  'docs/governance/repository-profile.json',
  'docs/governance/required-checks.phase01.json',
  'docs/governance/branch-protection-evidence.json',
]);

export const FORBIDDEN_ROOT_FILES = Object.freeze([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'pnpm-workspace.yaml',
  'lerna.json',
  'turbo.json',
  'nx.json',
  'rush.json',
]);

export const FORBIDDEN_SENSITIVE_PATTERNS = Object.freeze([
  /(^|\/)\.env(?:\.|$)/i,
  /\.(?:pem|key|p12|pfx|jks|keystore|mobileprovision|provisionprofile)$/i,
  /(^|\/)google-services\.json$/i,
  /(^|\/)GoogleService-Info\.plist$/i,
  /\.(?:apk|aab|ipa)$/i,
  /\.xcarchive(?:\/|$)/i,
  /(^|\/)DerivedData(?:\/|$)/i,
]);

export const PLACEHOLDER_PATTERN = /REPLACE_WITH_|example\.invalid|@OWNER_HANDLE/i;

export function toPosix(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '');
}

export function issue(code, message, repair, path = null, severity = 'error') {
  return { code, severity, path, message, repair };
}
