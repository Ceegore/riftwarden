import fs from 'node:fs';
import path from 'node:path';
import { contractPath, freezePath, readJson, repositoryRoot, writeJson } from './contracts.mjs';
import { fetchPackageMetadata, selectHighestStable } from './registry-client.mjs';

const contract = readJson(contractPath);
/**
 * @type {Array<{
 *   name: string,
 *   classification: string,
 *   requestedMajor: number|null,
 *   versionGroup: string|null,
 *   resolvedVersion: string,
 *   license: string|null,
 *   engines: Record<string, string>,
 *   peerDependencies: Record<string, string>,
 *   deprecated: string|null,
 *   integrity: string|null,
 *   tarball: string|null,
 *   repository: unknown,
 *   homepage: string|null,
 *   registrySource: string
 * }>}
 */
const resolved = [];

for (const item of [...contract.runtime, ...contract.development]) {
  const metadata = await fetchPackageMetadata(item.name);
  const candidate = selectHighestStable(metadata, item.major);
  const packageData = candidate.value;
  resolved.push({
    name: item.name,
    classification: item.group,
    requestedMajor: item.major,
    versionGroup: item.versionGroup ?? null,
    resolvedVersion: candidate.version,
    license: packageData.license ?? null,
    engines: packageData.engines ?? {},
    peerDependencies: packageData.peerDependencies ?? {},
    deprecated: packageData.deprecated ?? null,
    integrity: packageData.dist?.integrity ?? null,
    tarball: packageData.dist?.tarball ?? null,
    repository: packageData.repository ?? null,
    homepage: packageData.homepage ?? null,
    registrySource: `https://registry.npmjs.org/${item.name}`,
  });
}

const groupErrors = [];
for (const groupName of new Set(resolved.map((item) => item.versionGroup).filter(Boolean))) {
  const group = resolved.filter((item) => item.versionGroup === groupName);
  const versions = new Set(group.map((item) => item.resolvedVersion));
  if (versions.size > 1) groupErrors.push({ groupName, packages: group.map(({ name, resolvedVersion }) => ({ name, resolvedVersion })) });
}

const report = {
  schemaVersion: 1,
  status: groupErrors.length === 0 ? 'CANDIDATE_REQUIRES_INSTALL_VALIDATION' : 'BLOCKED_VERSION_GROUP_MISMATCH',
  resolvedAt: new Date().toISOString(),
  sourceRevision: process.env.GITHUB_SHA ?? process.env.CI_COMMIT_SHA ?? 'UNVERIFIED_LOCAL',
  nodeVersionObserved: process.version.replace(/^v/, ''),
  pnpmVersionObserved: process.env.npm_config_user_agent?.match(/pnpm\/(\d+\.\d+\.\d+)/)?.[1] ?? null,
  contractSha256: null,
  packages: resolved,
  versionGroupErrors: groupErrors,
  requiredNextSteps: [
    'Review every source, license, engines and peerDependencies field.',
    'Select exact Node and pnpm versions and write them into this report.',
    'Run apply-freeze, then pnpm install with scripts disabled and strict peers.',
    'Do not mark APPROVED until clean install, license, postinstall and build gates pass.',
  ],
};

writeJson(freezePath, report);
console.log(`Wrote ${path.relative(repositoryRoot, freezePath)} with ${resolved.length} candidates.`);
if (groupErrors.length > 0) process.exitCode = 1;
