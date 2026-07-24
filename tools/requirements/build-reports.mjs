#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readIndexedCollection, readJson } from './lib/shared.mjs';

const root = resolve(process.argv[2] ?? '.');
const outputDir = 'docs/requirements/generated';

/**
 * @typedef {Object} RequirementRecord
 * @property {string} id
 * @property {string} category
 * @property {string} norm
 * @property {string} status
 * @property {string} statement
 * @property {{chapter?: number}} [source]
 * @property {string[]} [ownerPhases]
 * @property {Array<{testIds?: string[]}>} [verification]
 */

/**
 * @typedef {Object} NormalizationRecord
 * @property {string} id
 * @property {string} topic
 * @property {string} status
 * @property {number} authorityPriority
 * @property {string[]} [affectedRequirementIds]
 * @property {string} reviewStatus
 * @property {string} canonicalRule
 */

/**
 * @typedef {Object} RequirementLink
 * @property {string} id
 * @property {string} statement
 */

/**
 * @typedef {Object} TestLink
 * @property {string} id
 */

/**
 * @typedef {Object} TraceabilityLink
 * @property {string} requirementId
 * @property {string[]} [testIds]
 * @property {string[]} [phaseIds]
 * @property {string[]} [screenIds]
 * @property {string[]} [normIds]
 */

/**
 * Builds a markdown table from headers and rows.
 * @param {string[]} headers Column headers.
 * @param {unknown[][]} rows Table rows.
 * @returns {string}
 */
function markdownTable(headers, rows) {
  /** @param {unknown} value */
  const escape = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
  return [
    `| ${headers.map(escape).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`),
  ].join('\n');
}

/**
 * Loads and concatenates requirements from the index.
 * @returns {Promise<RequirementRecord[]>}
 */
async function loadRequirements() {
  const index = await readJson(root, 'docs/requirements/requirements/index.json');
  /** @type {RequirementRecord[]} */
  const requirements = [];
  for (const filePath of index.files) {
    const payload = await readJson(root, filePath);
    requirements.push(...payload.requirements);
  }
  return requirements;
}

/**
 * Builds the requirements report markdown.
 * @param {RequirementRecord[]} requirements Requirement records.
 * @returns {string}
 */
function requirementsReport(requirements) {
  const counts = new Map();
  for (const requirement of requirements) {
    const key = `${requirement.category}|${requirement.norm}|${requirement.status}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const countRows = [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => [...key.split('|'), count]);
  const rows = [...requirements]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((requirement) => [
      requirement.id,
      requirement.category,
      requirement.norm,
      requirement.source?.chapter,
      requirement.ownerPhases?.join(', '),
      requirement.verification?.flatMap((entry) => entry.testIds ?? []).join(', '),
      requirement.status,
      requirement.statement,
    ]);
  return `# Generated Requirements Report\n\n> Generated from Phase 00 SSOT. Do not edit manually.\n\n## Totals\n\n- Requirements: ${requirements.length}\n\n${markdownTable(['Category', 'Norm', 'Status', 'Count'], countRows)}\n\n## Register\n\n${markdownTable(['ID', 'Category', 'Norm', 'Chapter', 'Owner phases', 'Tests', 'Status', 'Statement'], rows)}\n`;
}

/**
 * Builds the normalization report markdown.
 * @param {NormalizationRecord[]} records Normalization records.
 * @returns {string}
 */
function normalizationReport(records) {
  const rows = [...records]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((record) => [
      record.id,
      record.topic,
      record.status,
      record.authorityPriority,
      record.affectedRequirementIds?.join(', '),
      record.reviewStatus,
      record.canonicalRule,
    ]);
  return `# Generated Normalization Report\n\n> Generated from Phase 00 SSOT. Do not edit manually.\n\n${markdownTable(['ID', 'Topic', 'Status', 'Priority', 'Affected REQs', 'Review', 'Canonical rule'], rows)}\n`;
}

/**
 * Builds the traceability report markdown.
 * @param {RequirementLink[]} requirements Requirement records.
 * @param {TestLink[]} tests Test records.
 * @param {TraceabilityLink[]} links Traceability links.
 * @returns {string}
 */
function traceabilityReport(requirements, tests, links) {
  const requirementMap = new Map(requirements.map((entry) => [entry.id, entry]));
  const testMap = new Map(tests.map((entry) => [entry.id, entry]));
  const rows = [...links]
    .sort((left, right) => left.requirementId.localeCompare(right.requirementId))
    .map((link) => [
      link.requirementId,
      requirementMap.get(link.requirementId)?.statement ?? 'UNKNOWN',
      link.testIds?.join(', '),
      link.phaseIds?.join(', '),
      link.screenIds?.join(', '),
      link.normIds?.join(', '),
    ]);
  const linkedTests = new Set(links.flatMap((entry) => entry.testIds ?? []));
  const orphanTests = [...testMap.keys()].filter((id) => !linkedTests.has(id)).sort();
  const linkedRequirements = new Set(links.map((entry) => entry.requirementId));
  const orphanRequirements = [...requirementMap.keys()].filter((id) => !linkedRequirements.has(id)).sort();
  return `# Generated Traceability Report\n\n> Generated from Phase 00 SSOT. Do not edit manually.\n\n## Summary\n\n- Links: ${links.length}\n- Orphan requirements: ${orphanRequirements.length}\n- Orphan tests: ${orphanTests.length}\n\n## Orphan requirements\n\n${orphanRequirements.length ? orphanRequirements.map((id) => `- ${id}`).join('\n') : '- none'}\n\n## Orphan tests\n\n${orphanTests.length ? orphanTests.map((id) => `- ${id}`).join('\n') : '- none'}\n\n## Matrix\n\n${markdownTable(['Requirement', 'Statement', 'Tests', 'Phases', 'Screens', 'Norms'], rows)}\n`;
}

const requirements = await loadRequirements();
const normalization = await readIndexedCollection(root, 'docs/requirements/normalization-ledger.json', 'records');
const tests = await readJson(root, 'docs/requirements/tests.json');
const traceability = await readJson(root, 'docs/requirements/traceability.json');

const reports = {
  [`${outputDir}/requirements-report.md`]: requirementsReport(requirements),
  [`${outputDir}/normalization-report.md`]: normalizationReport(normalization.items),
  [`${outputDir}/traceability-report.md`]: traceabilityReport(requirements, tests.tests ?? [], traceability.links ?? []),
};
for (const [relativePath, content] of Object.entries(reports)) {
  const output = resolve(root, relativePath);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, content, 'utf8');
  console.log(`Wrote ${relativePath}`);
}
