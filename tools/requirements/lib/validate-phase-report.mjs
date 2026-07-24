import { ID_PATTERNS, fileExists, issue, pushEnum, pushId, pushRequiredString, readJson } from './shared.mjs';

/**
 * Validates a phase report JSON document.
 * @param {string} root Repository root.
 * @param {string} reportPath Repository-relative path to the phase report.
 * @returns {Promise<{issues: import('./shared.mjs').Issue[], report: *}>}
 */
export async function validatePhaseReport(root, reportPath) {
  /** @type {import('./shared.mjs').Issue[]} */
  const issues = [];
  if (!(await fileExists(root, reportPath))) {
    return { issues: [issue('error', 'REPORT_MISSING', 'Phase report JSON is missing.', reportPath)], report: null };
  }
  const report = await readJson(root, reportPath);
  pushId(issues, report?.phaseId, ID_PATTERNS.phase, `${reportPath}#phaseId`, 'REPORT_PHASE_ID');
  pushId(issues, report?.gateId, ID_PATTERNS.gate, `${reportPath}#gateId`, 'REPORT_GATE_ID');
  pushRequiredString(issues, report?.sourceRevision, `${reportPath}#sourceRevision`, 'REPORT_SOURCE_REVISION');
  pushRequiredString(issues, report?.branch, `${reportPath}#branch`, 'REPORT_BRANCH');
  pushEnum(issues, report?.gateDecision, ['PASS', 'BLOCKED'], `${reportPath}#gateDecision`, 'REPORT_GATE_DECISION');

  const collections = ['inputs', 'tickets', 'changedFiles', 'commands', 'manualTests', 'defects', 'gateItems'];
  for (const key of collections) {
    if (!Array.isArray(report?.[key])) {
      issues.push(issue('error', 'REPORT_ARRAY_REQUIRED', `${key} must be an array.`, `${reportPath}#${key}`));
    }
  }

  if (report?.gateDecision === 'PASS') {
    /** @param {{result?: string}} entry */
    const failedCommand = (entry) => entry.result !== 'PASS';
    if ((report.commands ?? []).filter(failedCommand).length > 0) issues.push(issue('error', 'REPORT_PASS_FAILED_COMMAND', 'PASS report contains failed/unverified commands.', reportPath));
    /** @param {{status?: string, evidenceLinks?: string[]}} entry */
    const incompleteGateItem = (entry) => entry.status !== 'PASS' || !Array.isArray(entry.evidenceLinks) || entry.evidenceLinks.length === 0;
    if ((report.gateItems ?? []).filter(incompleteGateItem).length > 0) issues.push(issue('error', 'REPORT_PASS_MISSING_EVIDENCE', 'Every G00 gate item needs PASS and evidence links.', reportPath));
    /** @param {{priority?: string, status?: string}} entry */
    const openBlocker = (entry) => ['P0', 'P1'].includes(entry.priority ?? '') && entry.status !== 'closed';
    if ((report.defects ?? []).filter(openBlocker).length > 0) issues.push(issue('error', 'REPORT_PASS_OPEN_BLOCKER', 'PASS report contains open P0/P1 defects.', reportPath));
  }
  return { issues, report };
}
