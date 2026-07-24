import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FORBIDDEN_ROOT_FILES,
  FORBIDDEN_SENSITIVE_PATTERNS,
  PLACEHOLDER_PATTERN,
  REQUIRED_DIRECTORIES,
  REQUIRED_FILES,
  issue,
  toPosix,
} from './contracts.mjs';
import { gitRoot, listGitVisibleFiles, listTrackedFiles } from './git-files.mjs';

/**
 * @typedef {{ code: string, severity: string, path: string|null, message: string, repair: string }} RepoFinding
 */

/**
 * @typedef {{
 *   schemaVersion: number,
 *   check: string,
 *   root: string,
 *   passed: boolean,
 *   summary: { errors: number, warnings: number, total: number },
 *   findings: RepoFinding[]
 * }} VerifyRootReport
 */

/**
 * @typedef {{
 *   name?: string,
 *   private?: boolean,
 *   workspaces?: unknown,
 *   packageManager?: string,
 *   engines?: {node?: string, pnpm?: string},
 *   dependencies?: Record<string, string>,
 *   devDependencies?: Record<string, string>,
 *   optionalDependencies?: Record<string, string>,
 *   peerDependencies?: Record<string, string>
 * }} PackageJson
 */

/**
 * @typedef {{
 *   schemaVersion?: number,
 *   phase?: string,
 *   singleProject?: boolean,
 *   mode?: string
 * }} RepositoryProfile
 */

/**
 * Reads JSON from disk and reports failures via findings.
 * @param {string} path File path.
 * @param {RepoFinding[]} findings Findings accumulator.
 * @param {string} label Human label used in errors.
 * @returns {unknown|null}
 */
function readJson(path, findings, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    findings.push(issue('REPO_INVALID_JSON', `${label} is not valid JSON: ${message}`, `Repair ${label} and rerun the validator.`, toPosix(path)));
    return null;
  }
}

/**
 * Validates the root package.json content.
 * @param {string} root Repository root.
 * @param {RepoFinding[]} findings Findings accumulator.
 * @param {RepositoryProfile|null} profile Repository profile (for migration mode).
 */
function validatePackage(root, findings, profile) {
  const path = resolve(root, 'package.json');
  const packageJson = /** @type {PackageJson|null} */ (readJson(path, findings, 'package.json'));
  if (!packageJson) return;
  const isMigration = profile?.mode === 'migration';

  if (packageJson.name !== 'riftwarden-auto-rpg-roguelite') {
    findings.push(issue('REPO_PACKAGE_NAME', 'package.json name does not match the fixed web package name.', 'Set name to riftwarden-auto-rpg-roguelite.', 'package.json'));
  }
  if (packageJson.private !== true) {
    findings.push(issue('REPO_NOT_PRIVATE', 'The root package is not private.', 'Set private to true.', 'package.json'));
  }
  if ('workspaces' in packageJson) {
    findings.push(issue('REPO_WORKSPACES', 'A workspaces field is forbidden.', 'Remove workspaces; this is a single-project repository.', 'package.json'));
  }
  if (!/^pnpm@10\.\d+\.\d+(?:[-+].*)?$/.test(packageJson.packageManager ?? '')) {
    findings.push(issue('REPO_PACKAGE_MANAGER', 'packageManager must identify pnpm Major 10 with an explicit bootstrap version.', 'Set packageManager to pnpm@10.x.y; Phase 02 freezes the approved current stable version.', 'package.json'));
  }
  if (!isMigration) {
    if (packageJson.engines?.node !== '>=22 <23' || packageJson.engines?.pnpm !== '>=10 <11') {
      findings.push(issue('REPO_ENGINES', 'Node/pnpm bootstrap engine ranges differ from Phase-01 contract.', 'Use node >=22 <23 and pnpm >=10 <11.', 'package.json'));
    }
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      const candidate = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (packageJson))[field];
      if (candidate && Object.keys(candidate).length > 0) {
        findings.push(issue('REPO_PHASE01_DEPENDENCY', `${field} must be empty in a clean Phase-01 bootstrap.`, 'Move dependency resolution to Phase 02 or document a migration blocker before Gate G01.', 'package.json'));
      }
    }
  }
}

/**
 * Validates the repository profile JSON contract.
 * @param {string} root Repository root.
 * @param {RepoFinding[]} findings Findings accumulator.
 */
function validateProfile(root, findings) {
  const profilePath = resolve(root, 'docs/governance/repository-profile.json');
  const profile = /** @type {RepositoryProfile|null} */ (readJson(profilePath, findings, 'repository profile'));
  if (!profile) return;
  if (profile.schemaVersion !== 1 || profile.phase !== '01' || profile.singleProject !== true) {
    findings.push(issue('REPO_PROFILE_CONTRACT', 'Repository profile is missing the Phase-01 single-project contract.', 'Use schemaVersion 1, phase 01 and singleProject true.', 'docs/governance/repository-profile.json'));
  }
  if (!['clean', 'migration'].includes(profile.mode ?? '')) {
    findings.push(issue('REPO_PROFILE_MODE', 'Repository profile mode must be clean or migration.', 'Choose the verified preflight mode.', 'docs/governance/repository-profile.json'));
  }
}

/**
 * Validates required/forbidden paths under the repository root.
 * @param {string} root Repository root.
 * @param {RepoFinding[]} findings Findings accumulator.
 */
function validatePaths(root, findings) {
  for (const relative of REQUIRED_FILES) {
    const absolute = resolve(root, relative);
    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
      findings.push(issue('REPO_REQUIRED_FILE', `Required file is missing: ${relative}`, `Create ${relative} from the approved Phase-01 contract.`, relative));
    }
  }
  for (const relative of REQUIRED_DIRECTORIES) {
    const absolute = resolve(root, relative);
    if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
      findings.push(issue('REPO_REQUIRED_DIRECTORY', `Required directory is missing: ${relative}`, `Create ${relative} with a README contract or .gitkeep.`, relative));
    }
  }
  for (const relative of FORBIDDEN_ROOT_FILES) {
    if (existsSync(resolve(root, relative))) {
      findings.push(issue('REPO_FORBIDDEN_ROOT_FILE', `Forbidden root file exists: ${relative}`, `Remove ${relative}; do not replace the single pnpm project with workspace/monorepo tooling.`, relative));
    }
  }
}

/**
 * Validates that the repository root is a single Git repository.
 * @param {string} root Repository root.
 * @param {RepoFinding[]} findings Findings accumulator.
 */
function validateGit(root, findings) {
  const discovered = gitRoot(root);
  if (!discovered) {
    findings.push(issue('REPO_NOT_GIT', 'The directory is not inside a Git repository.', 'Run git init or use the verified repository root.'));
    return;
  }
  if (resolve(discovered) !== resolve(root)) {
    findings.push(issue('REPO_NESTED_ROOT', `Validator root is nested under Git root ${discovered}.`, 'Run from the single repository root and remove nested repositories.'));
  }
  if (existsSync(resolve(root, '.gitmodules'))) {
    findings.push(issue('REPO_SUBMODULES', 'Git submodules are not part of the Phase-01 repository contract.', 'Remove .gitmodules or stop for an approved architecture decision.', '.gitmodules'));
  }
}

/**
 * Validates that no sensitive or signed artifacts are Git-visible.
 * @param {string} root Repository root.
 * @param {RepoFinding[]} findings Findings accumulator.
 */
function validateSensitiveFiles(root, findings) {
  const visible = listGitVisibleFiles(root);
  const tracked = new Set(listTrackedFiles(root));
  for (const relative of visible) {
    const normalized = toPosix(relative);
    if (FORBIDDEN_SENSITIVE_PATTERNS.some((pattern) => pattern.test(normalized))) {
      findings.push(issue(
        tracked.has(normalized) ? 'REPO_TRACKED_SENSITIVE' : 'REPO_VISIBLE_SENSITIVE',
        `Sensitive or signed artifact is ${tracked.has(normalized) ? 'tracked' : 'visible to Git'}: ${normalized}`,
        'Remove it, rotate any exposed credential, update ignore rules and audit Git history.',
        normalized,
      ));
    }
  }
}

/**
 * Validates that placeholders are absent in routable files.
 * @param {string} root Repository root.
 * @param {RepoFinding[]} findings Findings accumulator.
 */
function validatePlaceholders(root, findings) {
  for (const relative of ['.github/CODEOWNERS']) {
    const absolute = resolve(root, relative);
    if (!existsSync(absolute)) continue;
    const text = readFileSync(absolute, 'utf8');
    if (PLACEHOLDER_PATTERN.test(text)) {
      findings.push(issue('REPO_ACTIVE_PLACEHOLDER', `${relative} still contains an unresolved owner placeholder.`, 'Replace every placeholder with a real resolvable user/team before Gate G01.', relative));
    }
  }
}

/**
 * Runs the full Phase-01 root validation.
 * @param {string} [root] Repository root.
 * @returns {VerifyRootReport}
 */
export function verifyRoot(root = process.cwd()) {
  /** @type {RepoFinding[]} */
  const findings = [];
  validateGit(root, findings);
  validatePaths(root, findings);
  let profile = /** @type {RepositoryProfile|null} */ (null);
  if (existsSync(resolve(root, 'docs/governance/repository-profile.json'))) {
    profile = /** @type {RepositoryProfile|null} */ (readJson(resolve(root, 'docs/governance/repository-profile.json'), findings, 'repository profile'));
    validateProfile(root, findings);
  }
  if (existsSync(resolve(root, 'package.json'))) validatePackage(root, findings, profile);
  validateSensitiveFiles(root, findings);
  validatePlaceholders(root, findings);

  const errors = findings.filter((entry) => entry.severity === 'error').length;
  const warnings = findings.filter((entry) => entry.severity === 'warning').length;
  return {
    schemaVersion: 1,
    check: 'riftwarden-phase01-root',
    root: resolve(root),
    passed: errors === 0,
    summary: { errors, warnings, total: findings.length },
    findings,
  };
}
