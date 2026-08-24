#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const p = join(root, 'contracts', 'phase37', 'phase37-readiness.expected.json');
function rj(x) { if (!existsSync(x)) return null; try { return JSON.parse(readFileSync(x, 'utf8')); } catch { return null; } }
if (!existsSync(p)) { console.log(JSON.stringify({ schemaVersion: 1, phase: 37, gate: 'G37', status: 'BLOCKED', blockers: ['P37_CONTRACT_MISSING'] })); process.exit(2); }
const c = rj(p); const b = []; const s = [];
const mOk = c.evidence.modules.every((r) => existsSync(join(root, r)));
const tOk = c.evidence.tests.every((r) => existsSync(join(root, r)));
if (!mOk) b.push('P37_MODULES'); else s.push({ id: 'modules', count: c.evidence.modules.length });
if (!tOk) b.push('P37_TESTS'); else s.push({ id: 'tests', suites: c.evidence.tests.length });
for (const hb of c.hardBlockers) { if (!b.includes(hb)) b.push(hb); }
const r = { schemaVersion: 1, phase: 37, gate: 'G37', status: b.filter((x) => !c.hardBlockers.includes(x)).length ? 'BLOCKED' : (c.hardBlockers.length ? 'BLOCKED' : 'PASS'), blockers: b, satisfied: s };
console.log(JSON.stringify(r, null, 2)); process.exitCode = b.filter((x) => !new Set(c.hardBlockers).has(x)).length ? 1 : 0;