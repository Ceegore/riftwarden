import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(here, '../..');
export const contractPath = path.join(repositoryRoot, 'reference/dependency-contract.json');
export const freezePath = path.join(repositoryRoot, 'docs/reports/toolchain-freeze.json');
export const templatePath = path.join(repositoryRoot, 'package.phase02.template.json');
export const packagePath = path.join(repositoryRoot, 'package.json');

/**
 * Reads and parses a JSON file synchronously.
 * @param {string} filePath Absolute file path.
 * @returns {any}
 */
export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Writes a JSON value to disk with a trailing newline.
 * @param {string} filePath Absolute file path.
 * @param {unknown} value Value to serialize.
 */
export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/**
 * @typedef {{major: number, minor: number, patch: number, prerelease: string|null}} ParsedVersion
 */

/**
 * Parses a strict semantic version string.
 * @param {string} version Version string.
 * @returns {ParsedVersion|null}
 */
export function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (match === null) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (match[1] === undefined || match[2] === undefined || match[3] === undefined) return null;
  const prerelease = match[4] ?? null;
  return { major, minor, patch, prerelease };
}

/**
 * Compares two semantic versions.
 * @param {string} left Left version.
 * @param {string} right Right version.
 * @returns {number} Negative/zero/positive.
 */
export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (a === null || b === null) throw new Error(`Invalid semantic version: ${left} / ${right}`);
  for (const key of /** @type {('major'|'minor'|'patch')[]} */ (['major', 'minor', 'patch'])) {
    const av = a[key];
    const bv = b[key];
    if (av !== bv) return av - bv;
  }
  if (a.prerelease === null && b.prerelease !== null) return 1;
  if (a.prerelease !== null && b.prerelease === null) return -1;
  return String(a.prerelease).localeCompare(String(b.prerelease));
}

/**
 * Checks whether the value is an exact x.y.z version string.
 * @param {unknown} value Candidate value.
 * @returns {boolean}
 */
export function isExactVersion(value) {
  return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
}

/**
 * Hashes a UTF-8 string with SHA-256, returning a hex digest.
 * Note: returns a Promise — kept for compatibility with subtle-crypto use cases.
 * @param {string} text Input text.
 * @returns {Promise<string>}
 */
export function sha256Text(text) {
  return import('node:crypto').then(({ createHash }) =>
    createHash('sha256').update(text).digest('hex'),
  );
}
