import fs from 'node:fs';
import path from 'node:path';
import { readJson, repositoryRoot, writeJson } from './contracts.mjs';

/**
 * @typedef {Object} LifecycleScript
 * @property {string} name
 * @property {string} version
 * @property {Record<string, string>} lifecycle
 */

/** @type {LifecycleScript[]} */
const scripts = [];
const pnpmRoot = path.join(repositoryRoot, 'node_modules/.pnpm');
if (!fs.existsSync(pnpmRoot)) throw new Error('Install with --ignore-scripts before auditing lifecycle scripts.');

/**
 * Scans a package.json for lifecycle scripts and records them.
 * @param {string} packageJson Path to the package.json file.
 */
function scanPackageJson(packageJson) {
  /** @type {{ name?: string, version?: string, scripts?: Record<string, string> }} */
  const data = /** @type {{ name?: string, version?: string, scripts?: Record<string, string> }} */ (readJson(packageJson));
  /** @type {Record<string, string>} */
  const lifecycle = Object.fromEntries(['preinstall', 'install', 'postinstall', 'prepare'].filter((key) => data.scripts?.[key]).map((key) => [key, /** @type {string} */ (data.scripts?.[key])]));
  if (Object.keys(lifecycle).length > 0) scripts.push({ name: /** @type {string} */ (data.name), version: /** @type {string} */ (data.version), lifecycle });
}

for (const entry of fs.readdirSync(pnpmRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const modulesRoot = path.join(pnpmRoot, entry.name, 'node_modules');
  if (!fs.existsSync(modulesRoot)) continue;
  for (const top of fs.readdirSync(modulesRoot)) {
    const topPath = path.join(modulesRoot, top);
    if (top.startsWith('@')) {
      for (const child of fs.readdirSync(topPath)) {
        const packageJson = path.join(topPath, child, 'package.json');
        if (fs.existsSync(packageJson)) scanPackageJson(packageJson);
      }
    } else {
      const packageJson = path.join(topPath, 'package.json');
      if (fs.existsSync(packageJson)) scanPackageJson(packageJson);
    }
  }
}
const unique = [...new Map(scripts.map((item) => [`${item.name}@${item.version}`, item])).values()].sort((a, b) => a.name.localeCompare(b.name));
writeJson(path.join(repositoryRoot, 'docs/reports/postinstall-audit.json'), { schemaVersion: 1, generatedAt: new Date().toISOString(), status: 'REVIEW_REQUIRED', packages: unique });
console.log(`Found ${unique.length} packages with lifecycle scripts. Review before approval.`);
if (unique.length > 0) process.exitCode = 2;
