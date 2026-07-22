import { extname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { GENERATED_CONTRACT_MARKER, GENERATED_PREFIXES, HUMAN_EXTENSIONS, FAIL_AT, WARN_AT, isGeneratedPath } from './config.mjs';
import { listGitVisibleFiles } from '../repo/git-files.mjs';

/**
 * @typedef {{
 *   level: 'error'|'warning',
 *   code: string,
 *   path: string|null,
 *   lines: number|null,
 *   message: string
 * }} FileLengthFinding
 *
 * @typedef {{
 *   path: string,
 *   lines: number,
 *   generated: boolean
 * }} FileLengthEntry
 *
 * @typedef {{
 *   schemaVersion: number,
 *   check: string,
 *   root: string,
 *   passed: boolean,
 *   thresholds: { warning: number, failure: number },
 *   summary: { scanned: number, errors: number, warnings: number },
 *   findings: FileLengthFinding[],
 *   top20: FileLengthEntry[]
 * }} FileLengthReport
 */

/**
 * Counts the physical lines of a UTF-8 string.
 * @param {string} text Input text.
 * @returns {number}
 */
export function countPhysicalLines(text) {
  if (text.length === 0) return 0;
  const newlineCount = [...text].reduce((count, char) => count + (char === '\n' ? 1 : 0), 0);
  return newlineCount + (text.endsWith('\n') ? 0 : 1);
}

/**
 * Validates that every generated directory has a README contract marker.
 * @param {string} root Repository root.
 * @returns {FileLengthFinding[]}
 */
function validateGeneratedContracts(root) {
  /** @type {FileLengthFinding[]} */
  const findings = [];
  for (const prefix of GENERATED_PREFIXES) {
    const readme = resolve(root, prefix, 'README.md');
    if (!existsSync(readme) || !readFileSync(readme, 'utf8').includes(GENERATED_CONTRACT_MARKER)) {
      findings.push({
        level: 'error',
        code: 'LENGTH_GENERATED_CONTRACT',
        path: `${prefix}README.md`,
        lines: null,
        message: `Generated prefix ${prefix} lacks its contract marker.`,
      });
    }
  }
  return findings;
}

/**
 * Scans the repository for file-length violations.
 * @param {string} [root] Repository root.
 * @returns {FileLengthReport}
 */
export function scanFileLengths(root = process.cwd()) {
  /** @type {FileLengthFinding[]} */
  const findings = validateGeneratedContracts(root);
  /** @type {FileLengthEntry[]} */
  const files = [];
  for (const relative of listGitVisibleFiles(root)) {
    if (!HUMAN_EXTENSIONS.has(extname(relative).toLowerCase())) continue;
    const absolute = resolve(root, relative);
    if (!existsSync(absolute)) continue;
    const generated = isGeneratedPath(relative);
    let text;
    try {
      text = readFileSync(absolute, 'utf8');
    } catch (error) {
      /** @type {{message?: string}} */
      const err = error;
      findings.push({ level: 'error', code: 'LENGTH_READ_ERROR', path: relative, lines: null, message: err.message ?? String(error) });
      continue;
    }
    const lines = countPhysicalLines(text);
    files.push({ path: relative, lines, generated });
    if (generated) continue;
    if (lines >= FAIL_AT) {
      findings.push({ level: 'error', code: 'LENGTH_BLOCK', path: relative, lines, message: `Human-maintained file has ${lines} lines; split below 501.` });
    } else if (lines >= WARN_AT) {
      findings.push({ level: 'warning', code: 'LENGTH_WARN', path: relative, lines, message: `Human-maintained file has ${lines} lines; document split analysis.` });
    }
  }
  files.sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));
  const errors = findings.filter((finding) => finding.level === 'error').length;
  const warnings = findings.filter((finding) => finding.level === 'warning').length;
  return {
    schemaVersion: 1,
    check: 'riftwarden-file-length',
    root: resolve(root),
    passed: errors === 0,
    thresholds: { warning: WARN_AT, failure: FAIL_AT },
    summary: { scanned: files.length, errors, warnings },
    findings,
    top20: files.slice(0, 20),
  };
}
