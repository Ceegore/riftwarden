#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const p = join(root, 'contracts', 'phase42', 'phase42-readiness.expected.json');
function rj(x) { if (!existsSync(x)) return null; try { return JSON.parse(readFileSync(x, 'utf8')); } catch { return null; } }
if (!existsSync(p)) { console.log(JSON.stringify({ schemaVersion: 1, phase: 42, gate: 'G42', status: 'BLOCKED', blockers: ['P42_CONTRACT_MISSING'] })); process.exit(2); }
const c = rj(p); const b = []; const s = [];
const constants = rj(join(root, c.evidence.constants));
if (!constants || !constants.requiresOfflineFunctionality) b.push('P42_CONSTANTS'); else s.push({ id: 'constants' });
const auditsOk = c.evidence.auditReports.every((r) => existsSync(join(root, r)));
if (!auditsOk) b.push('P42_AUDIT_REPORTS'); else s.push({ id: 'audits', count: c.evidence.auditReports.length });
for (const hb of c.hardBlockers) { if (!b.includes(hb)) b.push(hb); }
const r = { schemaVersion: 1, phase: 42, gate: 'G42', status: 'BLOCKED', blockers: b, satisfied: s };
console.log(JSON.stringify(r, null, 2)); process.exitCode = b.filter((x) => !new Set(c.hardBlockers).has(x)).length ? 1 : 0;
