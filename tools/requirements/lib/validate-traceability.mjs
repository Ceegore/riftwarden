import {
  ID_PATTERNS, duplicates, fileExists, issue, pushEnum, pushId,
  pushRequiredString, readJson,
} from './shared.mjs';

/** @typedef {import('./shared.mjs').Issue} Issue */

const TESTS_FILE = 'docs/requirements/tests.json';
const TRACEABILITY_FILE = 'docs/requirements/traceability.json';

/**
 * Validates the test registry.
 * @param {string} root Repository root.
 * @returns {Promise<{issues: Issue[], tests: any[]}>}
 */
export async function validateTests(root) {
  /** @type {Issue[]} */
  const issues = [];
  if (!(await fileExists(root, TESTS_FILE))) {
    return { issues: [issue('error', 'TEST_REGISTRY_MISSING', 'Test registry is missing.', TESTS_FILE)], tests: [] };
  }
  const payload = await readJson(root, TESTS_FILE);
  const tests = Array.isArray(payload?.tests) ? payload.tests : [];
  if (!Array.isArray(payload?.tests)) {
    issues.push(issue('error', 'TEST_ARRAY_MISSING', 'tests must be an array.', `${TESTS_FILE}#tests`));
  }
  for (const [index, test] of tests.entries()) {
    const base = `${TESTS_FILE}#tests[${index}]`;
    pushId(issues, test?.id, ID_PATTERNS.test, `${base}.id`, 'TEST_ID');
    pushRequiredString(issues, test?.title, `${base}.title`, 'TEST_TITLE');
    pushEnum(
      issues,
      test?.status,
      ['planned', 'implemented', 'verified', 'blocked', 'deferred_by_spec'],
      `${base}.status`,
      'TEST_STATUS',
    );
    pushId(issues, test?.ownerPhase, ID_PATTERNS.phase, `${base}.ownerPhase`, 'TEST_OWNER_PHASE');
    pushEnum(
      issues,
      test?.method,
      ['unit', 'property', 'golden', 'integration', 'e2e', 'visual', 'native', 'manual', 'review', 'static'],
      `${base}.method`,
      'TEST_METHOD',
    );
  }
  /** @type {(test: any) => any} */
  const testId = (test) => test.id;
  for (const id of duplicates(tests.map(testId))) {
    issues.push(issue('error', 'TEST_DUPLICATE_ID', `Duplicate test ID: ${id}.`, TESTS_FILE));
  }
  return { issues, tests };
}

/**
 * Validates the traceability matrix.
 * @param {string} root Repository root.
 * @param {string} mode Validation mode ('draft' or 'gate').
 * @param {any[]} requirements Requirement records.
 * @param {any[]} tests Test records.
 * @param {any[]} normRecords Normalization records.
 * @returns {Promise<{issues: Issue[], links: any[]}>}
 */
export async function validateTraceability(root, mode, requirements, tests, normRecords) {
  /** @type {Issue[]} */
  const issues = [];
  if (!(await fileExists(root, TRACEABILITY_FILE))) {
    return { issues: [issue('error', 'TRACE_FILE_MISSING', 'Traceability matrix is missing.', TRACEABILITY_FILE)], links: [] };
  }
  const payload = await readJson(root, TRACEABILITY_FILE);
  const links = Array.isArray(payload?.links) ? payload.links : [];
  if (!Array.isArray(payload?.links)) {
    issues.push(issue('error', 'TRACE_LINKS_MISSING', 'links must be an array.', `${TRACEABILITY_FILE}#links`));
  }

  /** @type {(entry: any) => any} */
  const entryId = (entry) => entry.id;
  const requirementIds = new Set(requirements.map(entryId));
  const testIds = new Set(tests.map(entryId));
  /** @param {any} entry */
  const isActiveNorm = (entry) => entry.status === 'active';
  const normIds = new Set(normRecords.filter(isActiveNorm).map(entryId));

  for (const [index, link] of links.entries()) {
    const base = `${TRACEABILITY_FILE}#links[${index}]`;
    pushId(issues, link?.requirementId, ID_PATTERNS.requirement, `${base}.requirementId`, 'TRACE_REQ_ID');
    if (!requirementIds.has(link?.requirementId)) {
      issues.push(issue('error', 'TRACE_UNKNOWN_REQ', `Unknown requirement ${link?.requirementId}.`, base));
    }
    if (!Array.isArray(link?.testIds) || link.testIds.length === 0) {
      issues.push(issue('error', 'TRACE_TESTS_EMPTY', 'Each link requires at least one test ID.', `${base}.testIds`));
    } else {
      /** @type {(testId: any, testIndex: number) => void} */
      const pushTestId = (testId, testIndex) => {
        pushId(issues, testId, ID_PATTERNS.test, `${base}.testIds[${testIndex}]`, 'TRACE_TEST_ID');
        if (!testIds.has(testId)) issues.push(issue('error', 'TRACE_UNKNOWN_TEST', `Unknown test ${testId}.`, base));
      };
      link.testIds.forEach(pushTestId);
    }
    if (!Array.isArray(link?.phaseIds) || link.phaseIds.length === 0) {
      issues.push(issue('error', 'TRACE_PHASES_EMPTY', 'Each link requires at least one phase ID.', `${base}.phaseIds`));
    } else {
      /** @type {(phaseId: any, phaseIndex: number) => void} */
      const pushPhaseId = (phaseId, phaseIndex) => {
        pushId(issues, phaseId, ID_PATTERNS.phase, `${base}.phaseIds[${phaseIndex}]`, 'TRACE_PHASE_ID');
      };
      link.phaseIds.forEach(pushPhaseId);
    }
    for (const [screenIndex, screenId] of (link?.screenIds ?? []).entries()) {
      pushId(issues, screenId, ID_PATTERNS.screen, `${base}.screenIds[${screenIndex}]`, 'TRACE_SCREEN_ID');
    }
    for (const [normIndex, normId] of (link?.normIds ?? []).entries()) {
      pushId(issues, normId, ID_PATTERNS.normalization, `${base}.normIds[${normIndex}]`, 'TRACE_NORM_ID');
      if (!normIds.has(normId)) issues.push(issue('error', 'TRACE_UNKNOWN_NORM', `Unknown active norm ${normId}.`, base));
    }
  }

  /** @type {(link: any) => any} */
  const linkRequirementId = (link) => link.requirementId;
  for (const id of duplicates(links.map(linkRequirementId))) {
    issues.push(issue('error', 'TRACE_DUPLICATE_REQ_LINK', `Requirement ${id} has multiple traceability link records; merge them.`, TRACEABILITY_FILE));
  }

  const linkedRequirements = new Set(links.map(linkRequirementId));
  for (const requirement of requirements) {
    const hard = ['MUST', 'MUST_NOT'].includes(requirement.norm)
      || (Array.isArray(requirement.numericConstraints) && requirement.numericConstraints.length > 0);
    if (hard && !linkedRequirements.has(requirement.id)) {
      issues.push(issue('error', 'TRACE_ORPHAN_HARD_REQ', `Hard requirement ${requirement.id} is not linked.`, TRACEABILITY_FILE));
    } else if (!hard && !linkedRequirements.has(requirement.id)) {
      issues.push(issue('warning', 'TRACE_ORPHAN_REQ', `Requirement ${requirement.id} is not linked.`, TRACEABILITY_FILE));
    }
  }

  /** @param {any} link */
  const linkTestIds = (link) => link.testIds ?? [];
  const linkedTests = new Set(links.flatMap(linkTestIds));
  for (const test of tests) {
    if (!linkedTests.has(test.id)) {
      issues.push(issue(mode === 'gate' ? 'error' : 'warning', 'TRACE_ORPHAN_TEST', `Test ${test.id} is not linked.`, TRACEABILITY_FILE));
    }
  }

  return { issues, links };
}
