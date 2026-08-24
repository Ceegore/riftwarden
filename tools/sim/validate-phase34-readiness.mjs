#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const path = join(root, 'contracts', 'phase34', 'phase34-readiness.expected.json');
function rj(p) { if (!existsSync(p)) return null; try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }
if (!existsSync(path)) { console.log(JSON.stringify({ schemaVersion: 1, phase: 34, gate: 'G34', status: 'BLOCKED', blockers: ['P34_CONTRACT_MISSING'] })); process.exit(2); }
const c = rj(path); const b = []; const s = [];
const mOk = c.evidence.modules.every((r) => existsSync(join(root, r)));
const tOk = c.evidence.tests.every((r) => existsSync(join(root, r)));
if (!mOk) b.push('P34_MODULES'); else s.push({ id: 'modules', count: c.evidence.modules.length });
if (!tOk) b.push('P34_TESTS'); else s.push({ id: 'tests', suites: c.evidence.tests.length });
for (const hb of c.hardBlockers) { if (!b.includes(hb)) b.push(hb); }
const r = { schemaVersion: 1, phase: 34, gate: 'G34', status: b.filter((x) => !c.hardBlockers.includes(x)).length ? 'BLOCKED' : (c.hardBlockers.length ? 'BLOCKED' : 'PASS'), blockers: b, satisfied: s };
console.log(JSON.stringify(r, null, 2));
process.exitCode = b.filter((x) => !new Set(c.hardBlockers).has(x)).length ? 1 : 0;