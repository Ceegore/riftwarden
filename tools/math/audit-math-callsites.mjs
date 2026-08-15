#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? 'src');
const findings = [];
const allowedRounding = new Set(['game/sim/math/rounding.ts']);
function walk(p) {
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const q = join(p, e.name);
    if (e.isDirectory()) walk(q);
    else if (/\.(ts|tsx)$/.test(e.name)) {
      const rel = resolve(q).replaceAll('\\', '/');
      const relToRoot = rel.startsWith(root) ? rel.slice(root.length + 1) : rel;
      const s = readFileSync(q, 'utf8');
      if (/Math\.round\s*\(/.test(s) && !allowedRounding.has(relToRoot)) findings.push({ code: 'P12_LOCAL_ROUNDING', file: relToRoot });
      if (/\*\s*10_000|\/\s*10_000/.test(s) && !relToRoot.includes('game/sim/math/')) findings.push({ code: 'P12_LOCAL_BPS_MATH', file: relToRoot });
    }
  }
}
if (existsSync(root)) walk(root);
console.log(JSON.stringify({ schemaVersion: 1, status: findings.length ? 'BLOCKED' : 'PASS', findings }, null, 2));
process.exitCode = findings.length ? 2 : 0;
