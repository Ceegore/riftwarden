#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'; import { resolve, join } from 'node:path';
const root = resolve(process.argv[2] ?? '.'); const p = join(root, 'contracts', 'phase48', 'phase48-readiness.expected.json');
function rj(x) { if (!existsSync(x)) return null; try { return JSON.parse(readFileSync(x, 'utf8')); } catch { return null; } }
if (!existsSync(p)) { console.log(JSON.stringify({ schemaVersion: 1, phase: 48, gate: 'G48', status: 'BLOCKED', blockers: ['P48_CONTRACT_MISSING'] })); process.exit(2); }
const c = rj(p); const b = []; const s = [];
const chk = existsSync(join(root, c.evidence.checklist));
if (!chk) b.push('P48_CHECKLIST'); else s.push({ id: 'checklist' });
for (const hb of c.hardBlockers) { if (!b.includes(hb)) b.push(hb); }
const r = { schemaVersion: 1, phase: 48, gate: 'G48', status: 'BLOCKED', blockers: b, satisfied: s };
console.log(JSON.stringify(r, null, 2)); process.exitCode = b.filter((x) => !new Set(c.hardBlockers).has(x)).length ? 1 : 0;