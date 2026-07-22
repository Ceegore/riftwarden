import fs from 'node:fs';
import path from 'node:path';
import { contractPath, freezePath, isExactVersion, packagePath, readJson, repositoryRoot } from './contracts.mjs';

/**
 * @typedef {{ name: string, group: string, major: number|null }} ContractEntry
 *
 * @typedef {{ runtime: ContractEntry[], development: ContractEntry[] }} DependencyContract
 *
 * @typedef {{ packages: Array<{ name: string, resolvedVersion: string }> }} FreezeFile
 *
 * @typedef {{ packageManager?: string, workspaces?: unknown, dependencies?: Record<string, string>, devDependencies?: Record<string, string> }} PackageJsonShape
 */

const errors = [];
/** @type {DependencyContract} */
const contract = /** @type {DependencyContract} */ (/** @type {unknown} */ (readJson(contractPath)));
/** @type {FreezeFile} */
const freeze = /** @type {FreezeFile} */ (/** @type {unknown} */ (readJson(freezePath)));
/** @type {PackageJsonShape} */
const pkg = /** @type {PackageJsonShape} */ (/** @type {unknown} */ (readJson(packagePath)));
const allowed = new Map([...contract.runtime, ...contract.development].map((/** @type {ContractEntry} */ item) => [item.name, item]));
const frozen = new Map(freeze.packages.map((/** @type {{name: string, resolvedVersion: string}} */ item) => [item.name, item.resolvedVersion]));

if ('workspaces' in pkg) errors.push('package.json must not contain workspaces.');
if (!/^pnpm@10\.\d+\.\d+$/.test(pkg.packageManager ?? '')) errors.push('packageManager must pin exact pnpm major 10.');
for (const section of /** @type {Array<keyof Pick<PackageJsonShape, 'dependencies'|'devDependencies'>>} */ (['dependencies', 'devDependencies'])) {
  for (const [name, version] of Object.entries(pkg[section] ?? {})) {
    if (!allowed.has(name)) errors.push(`${section}.${name} is outside dependency-contract.json.`);
    if (!isExactVersion(version)) errors.push(`${section}.${name} is not an exact x.y.z version.`);
    if (frozen.get(name) !== version) errors.push(`${section}.${name} differs from toolchain-freeze.json.`);
    const major = allowed.get(name)?.major;
    if (major != null && Number(version.split('.')[0]) !== major) errors.push(`${name} violates fixed major ${major}.`);
  }
}
for (const name of allowed.keys()) {
  if (!(name in (pkg.dependencies ?? {})) && !(name in (pkg.devDependencies ?? {}))) errors.push(`Allowed required package missing: ${name}`);
}
for (const forbidden of ['package-lock.json', 'yarn.lock', 'bun.lock', 'bun.lockb', 'pnpm-workspace.yaml']) {
  if (fs.existsSync(path.join(repositoryRoot, forbidden))) errors.push(`Forbidden root file exists: ${forbidden}`);
}
if (!fs.existsSync(path.join(repositoryRoot, 'pnpm-lock.yaml'))) errors.push('pnpm-lock.yaml is missing.');

if (errors.length > 0) {
  console.error(errors.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}
console.log('Toolchain freeze structure is valid. Runtime install/build evidence is still required separately.');
