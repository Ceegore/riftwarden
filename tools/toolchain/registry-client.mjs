import { compareVersions, parseVersion } from './contracts.mjs';

export function encodePackageName(name) {
  return name.startsWith('@') ? name.replace('/', '%2f') : name;
}

export async function fetchPackageMetadata(name, fetchImpl = fetch) {
  const response = await fetchImpl(`https://registry.npmjs.org/${encodePackageName(name)}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  });
  if (!response.ok) throw new Error(`Registry request failed for ${name}: ${response.status}`);
  return response.json();
}

export function stableCandidates(metadata, allowedMajor) {
  return Object.entries(metadata.versions ?? {})
    .filter(([version, value]) => {
      const parsed = parseVersion(version);
      return parsed !== null && parsed.prerelease === null && (allowedMajor == null || parsed.major === allowedMajor) && value.deprecated == null;
    })
    .map(([version, value]) => ({ version, value }))
    .sort((a, b) => compareVersions(b.version, a.version));
}

export function selectHighestStable(metadata, allowedMajor) {
  const [candidate] = stableCandidates(metadata, allowedMajor);
  if (candidate === undefined) {
    throw new Error(`No stable non-deprecated version matches major ${String(allowedMajor)}`);
  }
  return candidate;
}
