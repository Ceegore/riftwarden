import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from '../lib/fs-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const phase = Number(args.phase ?? process.env.RIFTWARDEN_IMPLEMENTATION_PHASE ?? 3);
const registry = JSON.parse(await readFile(args.registry ?? 'ci/phase-gates.json', 'utf8'));
const rows = registry.checks.map((c) => ({ ...c, state: phase >= c.requiredFromPhase ? 'required' : `not-enabled-before-phase-${String(c.requiredFromPhase).padStart(2, '0')}` }));
const out = args.out ?? 'artifacts/ci/ci-gate-map.json';
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify({ schemaVersion: 1, phase, checks: rows }, null, 2)}\n`);
console.log(out);
