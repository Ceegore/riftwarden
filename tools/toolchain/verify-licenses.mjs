import fs from 'node:fs';
import path from 'node:path';
import { readJson, repositoryRoot, writeJson } from './contracts.mjs';
import { classifyLicense } from './license-lib.mjs';

const policy = readJson(path.join(repositoryRoot, 'reference/license-policy.json'));
const pnpmRoot = path.join(repositoryRoot, 'node_modules/.pnpm');
if (!fs.existsSync(pnpmRoot)) throw new Error('node_modules/.pnpm is missing; perform the audited install first.');

const packages = [];
for (const entry of fs.readdirSync(pnpmRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const modulesRoot = path.join(pnpmRoot, entry.name, 'node_modules');
  if (!fs.existsSync(modulesRoot)) continue;
  const candidates = [];
  for (const name of fs.readdirSync(modulesRoot)) {
    if (name.startsWith('@')) {
      for (const scoped of fs.readdirSync(path.join(modulesRoot, name))) candidates.push(path.join(modulesRoot, name, scoped));
    } else candidates.push(path.join(modulesRoot, name));
  }
  for (const packageDir of candidates) {
    const packageJson = path.join(packageDir, 'package.json');
    if (!fs.existsSync(packageJson)) continue;
    const data = readJson(packageJson);
    packages.push({
      name: data.name ?? path.basename(packageDir),
      version: data.version ?? null,
      license: data.license ?? null,
      source: data.repository ?? data.homepage ?? null,
      classification: classifyLicense(data.license, policy),
    });
  }
}

const unique = [...new Map(packages.map((item) => [`${item.name}@${item.version}`, item])).values()]
  .sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
const blocked = unique.filter((item) => item.classification === 'block');
const manual = unique.filter((item) => item.classification === 'manual-review');
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), packageCount: unique.length, blocked, manualReview: manual, packages: unique };
writeJson(path.join(repositoryRoot, 'docs/reports/license-inventory.json'), report);
if (blocked.length > 0 || manual.length > 0) {
  console.error(`License gate blocked: ${blocked.length} blocked, ${manual.length} manual review.`);
  process.exit(1);
}
console.log(`License gate passed for ${unique.length} packages.`);
