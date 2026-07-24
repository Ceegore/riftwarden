import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const dir = 'artifacts/security/dependencies';
mkdirSync(dir, { recursive: true });

let auditOutput = '';
try {
  auditOutput = execSync('pnpm audit --json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
} catch (/** @type {any} */ err) {
  // pnpm audit exits non-zero if advisories exist — capture stdout anyway
  auditOutput = err.stdout || '{}';
}
writeFileSync(`${dir}/pnpm-audit.json`, auditOutput);

// Now run the checker
const data = JSON.parse(readFileSync(`${dir}/pnpm-audit.json`, 'utf8'));
const findings = [];
function visit(value, path = '$') {
  if (Array.isArray(value)) value.forEach((v, i) => visit(v, `${path}[${i}]`));
  else if (value && typeof value === 'object') {
    const severity = String(value.severity ?? value.cvss?.severity ?? '').toLowerCase();
    if (['critical', 'high'].includes(severity)) findings.push({ path, severity, id: value.id ?? value.advisoryId ?? value.cve ?? null, title: value.title ?? value.name ?? null });
    for (const [k, v] of Object.entries(value)) visit(v, `${path}.${k}`);
  }
}
visit(data);
const result = { schemaVersion: 1, ok: findings.length === 0, blockingFindings: findings };
console.log(JSON.stringify(result, null, 2));
if (findings.length) process.exitCode = 1;
