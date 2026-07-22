import { compareVersions, parseVersion } from './contracts.mjs';

/**
 * URL-encodes a scoped package name for the npm registry endpoints.
 * @param {string} name Package name.
 * @returns {string}
 */
export function encodePackageName(name) {
  return name.startsWith('@') ? name.replace('/', '%2f') : name;
}

/**
 * @typedef {{(input: string, init?: RequestInit): Promise<Response>}} FetchLike
 */

/**
 * Fetches the npm metadata for a single package.
 * @param {string} name Package name.
 * @param {FetchLike} [fetchImpl] Optional fetch implementation (for testing).
 * @returns {Promise<unknown>}
 */
export async function fetchPackageMetadata(name, fetchImpl = fetch) {
  const response = await fetchImpl(`https://registry.npmjs.org/${encodePackageName(name)}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  });
  if (!response.ok) throw new Error(`Registry request failed for ${name}: ${response.status}`);
  return response.json();
}

/**
 * Returns the list of stable, non-deprecated candidates for the given major.
 * @param {{versions?: Record<string, {deprecated?: string|null}>}} metadata Package metadata.
 * @param {number|null} [allowedMajor] Optional pinned major.
 * @returns {Array<{version: string, value: {deprecated?: string|null}}>}
 */
export function stableCandidates(metadata, allowedMajor) {
  return Object.entries(metadata.versions ?? {})
    .filter(([version, value]) => {
      const parsed = parseVersion(version);
      return parsed !== null && parsed.prerelease === null && (allowedMajor == null || parsed.major === allowedMajor) && value.deprecated == null;
    })
    .map(([version, value]) => ({ version, value }))
    .sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Selects the highest stable, non-deprecated candidate for a given major.
 * @param {{versions?: Record<string, {deprecated?: string|null}>}} metadata Package metadata.
 * @param {number|null} allowedMajor Optionally pinned major.
 * @returns {{version: string, value: {deprecated?: string|null}}}
 */
export function selectHighestStable(metadata, allowedMajor) {
  const [candidate] = stableCandidates(metadata, allowedMajor);
  if (candidate === undefined) {
    throw new Error(`No stable non-deprecated version matches major ${String(allowedMajor)}`);
  }
  return candidate;
}
