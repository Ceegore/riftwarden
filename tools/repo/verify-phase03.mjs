import { access, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const required = [
  '.github/workflows/pr.yml', '.github/workflows/main.yml', '.github/workflows/nightly.yml', '.github/workflows/release.yml',
  'ci/phase-gates.json', 'ci/required-checks.json', 'ci/action-pins.lock.json', 'ci/artifact-policy.json',
  'tools/build/create-manifest.mjs', 'tools/deps/report.mjs', 'tools/deps/create-cyclonedx.mjs',
  'docs/reports/ci-gate-map.md', 'docs/reports/branch-protection-evidence.json'
];
const errors = [];
for (const file of required) try { await access(file); } catch { errors.push(`missing ${file}`); }
try { execFileSync(process.execPath, ['tools/ci/verify-workflows.mjs'], { stdio: 'pipe' }); }
catch (e) { errors.push(`workflow verification failed: ${e.stdout?.toString() || e.message}`); }
for (const name of ['ci/action-pins.lock.json','ci/required-checks.json']) {
  try { JSON.parse(await readFile(name, 'utf8')); } catch (e) { errors.push(`${name}: invalid JSON: ${e.message}`); }
}
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
for (const script of ['ci:verify-workflows','build:manifest','deps:report','deps:sbom','security:audit','security:secrets','verify:phase03']) {
  if (!packageJson.scripts?.[script]) errors.push(`missing package script ${script}`);
}
console.log(JSON.stringify({ schemaVersion: 1, ok: errors.length === 0, errors }, null, 2));
if (errors.length) process.exitCode = 1;
