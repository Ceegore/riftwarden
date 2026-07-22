#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PLACEHOLDER_PATTERN } from './contracts.mjs';

/**
 * @typedef {{
 *   pullRequestRequired?: boolean,
 *   dismissStaleApprovals?: boolean,
 *   requireCodeOwnerReview?: boolean,
 *   requireLastPushApprovalByOtherUser?: boolean,
 *   strictStatusChecks?: boolean,
 *   conversationResolutionRequired?: boolean,
 *   linearHistoryRequired?: boolean,
 *   minimumApprovals?: number,
 *   forcePushAllowed?: boolean,
 *   deletionAllowed?: boolean,
 *   adminBypassAllowed?: boolean,
 *   requiredStatusChecks?: string[]
 * }} BranchRules
 */

/**
 * @typedef {{
 *   status?: string,
 *   provider?: string,
 *   repository?: string,
 *   capturedAtUtc?: string,
 *   sourceRevision?: string,
 *   reviewedBy?: string,
 *   reviewedAtUtc?: string,
 *   rules?: BranchRules,
 *   evidenceFiles?: Array<{path?: string, sha256?: string}>
 * }} EvidenceRecord
 */

/**
 * @typedef {{requiredChecks?: string[]}} RequiredChecks
 */

const root = process.cwd();
const evidencePath = resolve(root, 'docs/governance/branch-protection-evidence.json');
const checksPath = resolve(root, 'docs/governance/required-checks.phase01.json');
const codeownersPath = resolve(root, '.github/CODEOWNERS');
/** @type {string[]} */
const findings = [];
const booleansThatMustBeTrue = [
  'pullRequestRequired', 'dismissStaleApprovals', 'requireCodeOwnerReview',
  'requireLastPushApprovalByOtherUser', 'strictStatusChecks',
  'conversationResolutionRequired', 'linearHistoryRequired',
];
const criticalCodeownerPaths = ['/src/game/sim/', '/src/storage/', '/android/', '/ios/', '/content/', '/docs/release/', '/store/'];

/**
 * Loads a JSON file and pushes a finding on failure.
 * @param {string} path File path.
 * @param {string} label Human label.
 * @returns {unknown|null}
 */
function loadJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    findings.push(`${label} is unreadable/invalid: ${message}`);
    return null;
  }
}

const evidence = /** @type {EvidenceRecord|null} */ (loadJson(evidencePath, 'branch protection evidence'));
const required = /** @type {RequiredChecks|null} */ (loadJson(checksPath, 'required checks'));
if (evidence && required) {
  if (evidence.status !== 'VERIFIED') findings.push('Evidence status must be VERIFIED.');
  for (const field of ['provider', 'repository', 'capturedAtUtc', 'sourceRevision', 'reviewedBy', 'reviewedAtUtc']) {
    const candidate = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (evidence))[field];
    if (!candidate || PLACEHOLDER_PATTERN.test(String(candidate))) findings.push(`Unresolved evidence field: ${field}.`);
  }
  if (!/^[0-9a-f]{40}$/i.test(evidence.sourceRevision ?? '')) findings.push('sourceRevision must be a full 40-character Git SHA.');
  const rules = evidence.rules ?? {};
  for (const field of booleansThatMustBeTrue) if (/** @type {Record<string, unknown>} */ (/** @type {unknown} */ (rules))[field] !== true) findings.push(`Branch rule must enable ${field}.`);
  if ((rules.minimumApprovals ?? 0) < 1) findings.push('At least one approval is required.');
  if (rules.forcePushAllowed !== false) findings.push('Force pushes must be disabled.');
  if (rules.deletionAllowed !== false) findings.push('Branch deletion must be disabled.');
  if (rules.adminBypassAllowed !== false) findings.push('Routine admin bypass must be disabled for Gate G01.');
  const actualChecks = new Set(rules.requiredStatusChecks ?? []);
  for (const check of required.requiredChecks ?? []) if (!actualChecks.has(check)) findings.push(`Missing required status check: ${check}.`);

  if (!Array.isArray(evidence.evidenceFiles) || evidence.evidenceFiles.length === 0) {
    findings.push('At least one hosting export or screenshot evidence file is required.');
  } else {
    for (const entry of evidence.evidenceFiles) {
      const path = resolve(root, entry.path ?? '');
      if (!entry.path || !existsSync(path)) {
        findings.push(`Evidence file is missing: ${entry.path ?? '<empty>'}.`);
        continue;
      }
      const actualHash = createHash('sha256').update(readFileSync(path)).digest('hex');
      if (entry.sha256 !== actualHash) findings.push(`Evidence hash mismatch: ${entry.path}.`);
    }
  }
}

if (existsSync(codeownersPath)) {
  const codeowners = readFileSync(codeownersPath, 'utf8');
  if (PLACEHOLDER_PATTERN.test(codeowners)) findings.push('CODEOWNERS contains unresolved placeholders.');
  for (const path of criticalCodeownerPaths) {
    if (!codeowners.includes(path)) findings.push(`CODEOWNERS lacks critical path: ${path}.`);
  }
} else {
  findings.push('CODEOWNERS file is missing.');
}

if (findings.length === 0) {
  process.stdout.write('Governance evidence: PASS\n');
} else {
  process.stderr.write('Governance evidence: FAIL\n');
  for (const finding of findings) process.stderr.write(`- ${finding}\n`);
  process.exitCode = 1;
}