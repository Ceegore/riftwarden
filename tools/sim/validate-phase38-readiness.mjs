#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const p = join(root, 'contracts', 'phase38', 'phase38-readiness.expected.json');
function rj(x) { if (!existsSync(x)) return null; try { return JSON.parse(readFileSync(x, 'utf8')); } catch { return null; } }
if (!existsSync(p)) { console.log(JSON.stringify({ schemaVersion: 1, phase: 38, gate: 'G38', status: 'BLOCKED', blockers: ['P38_CONTRACT_MISSING'] })); process.exit(2); }
const c = rj(p); const b = []; const s = [];
const constants = rj(join(root, c.evidence.constants));
if (!constants || constants.maxAtlasDimension !== 2048) b.push('P38_CONSTANTS'); else s.push({ id: 'constants' });
const mOk = c.evidence.modules.every((r) => existsSync(join(root, r)));
if (!mOk) b.push('P38_MODULES'); else s.push({ id: 'modules', count: c.evidence.modules.length });
for (const hb of c.hardBlockers) { if (!b.includes(hb)) b.push(hb); }
const r = { schemaVersion: 1, phase: 38, gate: 'G38', status: 'BLOCKED', blockers: b, satisfied: s };
console.log(JSON.stringify(r, null, 2)); process.exitCode = b.filter((x) => !new Set(c.hardBlockers).has(x)).length ? 1 : 0;