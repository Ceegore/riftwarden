#!/usr/bin/env node
// Build chunk-e.json (P00-T02e) chapters 64..78
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

const sha = (s) => 'sha256:' + createHash('sha256').update(s, 'utf8').digest('hex');
const R = [], X = [];
let i = 0;
const id = () => 'REQ-TEMP-E-' + String(++i).padStart(4, '0');

const M = (r) => {
  const [ch, loc, norm, cat, own, pln, tid, exc, stmt, num, title] = r;
  const owners = own.split(',').map(s => s.trim()).filter(Boolean);
  const tids = tid.split(',').map(s => s.trim()).filter(Boolean);
  let vt = 'static';
  if (cat === 'Sim' || cat === 'Save' || cat === 'Perf' || cat === 'Security') vt = 'unit';
  else if (cat === 'UX' || cat === 'A11y') vt = 'visual';
  else if (cat === 'QA') vt = 'integration';
  else if (cat === 'Android' || cat === 'iOS') vt = 'native';
  else if (cat === 'Store') vt = 'review';
  else if (cat === 'Product') vt = 'review';
  const nc = [];
  if (num) for (const p of num.split(';').map(s => s.trim()).filter(Boolean)) {
    const [u, e] = p.split('|').map(s => s.trim());
    const o = { unit: u };
    if (e.includes('..')) { const [lo, hi] = e.split('..').map(Number); o.min = lo; o.max = hi; }
    else if (e.startsWith('min:')) o.min = Number(e.slice(4));
    else if (e.startsWith('max:')) o.max = Number(e.slice(4));
    else o.value = Number(e);
    nc.push(o);
  }
  R.push({
    id: id(),
    title: title ?? stmt.slice(0, 60),
    statement: stmt,
    norm,
    category: cat,
    source: { sourceId: 'gdd-v5', chapter: ch, section: null, locator: loc, quoteHash: sha(exc), originalExcerpt: exc },
    ownerPhases: owners,
    verification: [{ type: vt, plannedPhase: pln, testIds: tids }],
    numericConstraints: nc,
    relatedNormIds: [],
    relatedScreenIds: [],
    status: 'planned',
    notes: null
  });
};

// Data is loaded from external JSON file to keep this script small
import { readFile } from 'node:fs/promises';
const dataPath = process.argv[2] || 'tools/requirements/_chunk_e_data.json';
const raw = JSON.parse(await readFile(dataPath, 'utf8'));
for (const row of raw) M(row);

const out = { schemaVersion: '1.0', chunk: 'e', chapterRange: { lo: 64, hi: 78 }, requirements: R, contextOnly: X };
const path = 'docs/requirements/requirements/_staging/chunk-e.json';
await mkdir(dirname(path), { recursive: true });
await rm(path, { force: true });
await writeFile(path, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('Wrote', path, 'with', R.length, 'requirements');