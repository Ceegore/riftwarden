import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from '../lib/fs-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const input = args.input ?? 'artifacts/security/dependencies';
const out = args.out ?? 'artifacts/security/license-report.json';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const list = JSON.parse(await readFile(path.join(input, 'pnpm-list.json'), 'utf8'));
const licensesRaw = JSON.parse(await readFile(path.join(input, 'pnpm-licenses.json'), 'utf8'));
const directRuntime = new Set(Object.keys(pkg.dependencies ?? {}));
const directDev = new Set(Object.keys(pkg.devDependencies ?? {}));
const licenses = new Map();
function collectLicense(value, license = null) {
  if (Array.isArray(value)) for (const item of value) collectLicense(item, license);
  else if (value && typeof value === 'object') {
    const next = value.license ?? value.name ?? license;
    if (value.path || value.version || value.name) {
      const key = `${value.name ?? value.path ?? 'unknown'}@${value.version ?? 'unknown'}`;
      licenses.set(key, { license: value.license ?? license ?? 'UNKNOWN', source: value.repository ?? value.homepage ?? null });
    }
    for (const item of Object.values(value)) collectLicense(item, next);
  }
}
collectLicense(licensesRaw);
const components = [];
function walk(node, parent = null) {
  if (Array.isArray(node)) return node.forEach((x) => walk(x, parent));
  if (!node || typeof node !== 'object') return;
  if (node.name && node.version) {
    const key = `${node.name}@${node.version}`;
    const l = licenses.get(key) ?? { license: node.license ?? 'UNKNOWN', source: node.repository ?? null };
    components.push({ name: node.name, version: node.version, direct: directRuntime.has(node.name) || directDev.has(node.name), scope: directRuntime.has(node.name) ? 'runtime' : directDev.has(node.name) ? 'development' : 'transitive', license: l.license, source: l.source, parent });
  }
  for (const dep of Object.values(node.dependencies ?? {})) walk(dep, node.name ?? parent);
}
walk(list);
const unique = [...new Map(components.map((x) => [`${x.name}@${x.version}:${x.scope}`, x])).values()].sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`, 'en'));
const unknown = unique.filter((x) => !x.license || /UNKNOWN|UNLICENSED/i.test(String(x.license)));
const report = { schemaVersion: 1, package: pkg.name, components: unique, summary: { total: unique.length, runtime: unique.filter((x) => x.scope === 'runtime').length, development: unique.filter((x) => x.scope === 'development').length, transitive: unique.filter((x) => x.scope === 'transitive').length, unknownLicenses: unknown.length }, ok: unknown.length === 0 };
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(out);
if (unknown.length) process.exitCode = 1;
