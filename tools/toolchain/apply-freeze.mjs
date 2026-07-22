import fs from 'node:fs';
import path from 'node:path';
import { freezePath, isExactVersion, packagePath, readJson, repositoryRoot, templatePath, writeJson } from './contracts.mjs';

const freeze = readJson(freezePath);
const template = readJson(templatePath);
if (!isExactVersion(freeze.nodeVersionApproved) || !isExactVersion(freeze.pnpmVersionApproved)) {
  throw new Error('toolchain-freeze.json must contain exact nodeVersionApproved and pnpmVersionApproved.');
}

/**
 * @type {Map<string, {name: string, resolvedVersion: string}>}
 */
const byName = new Map(freeze.packages.map((item) => [item.name, item]));
for (const section of ['dependencies', 'devDependencies']) {
  for (const name of Object.keys(template[section])) {
    const item = byName.get(name);
    if (item === undefined || !isExactVersion(item.resolvedVersion)) throw new Error(`Missing exact freeze for ${name}`);
    template[section][name] = item.resolvedVersion;
  }
}

template.packageManager = `pnpm@${freeze.pnpmVersionApproved}`;
const major = Number(freeze.nodeVersionApproved.split('.')[0]);
template.engines.node = `>=${freeze.nodeVersionApproved} <${major + 1}`;
template.engines.pnpm = `>=${freeze.pnpmVersionApproved} <11`;
writeJson(packagePath, template);
fs.writeFileSync(path.join(repositoryRoot, '.node-version'), `${freeze.nodeVersionApproved}\n`, 'utf8');
console.log('Applied exact versions to package.json and .node-version. No install was executed.');
