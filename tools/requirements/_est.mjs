// Test how many lines the current REQS would produce.
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

function sha(t) { return 'sha256:' + createHash('sha256').update(t, 'utf8').digest('hex'); }

const REQS = [];
const sample = {
  chapter: 1, locator: 'block:12', norm: 'MUST_NOT', category: 'Product',
  ownerPhases: ['PHASE-00'], verification: [{ type: 'unit', plannedPhase: 'PHASE-01', testIds: ['GR-PHASE00-001'] }],
  statement: 'Es dürfen keine nicht beschriebenen Kernmechaniken ergänzt werden.',
  quoteHash: sha('x'), originalExcerpt: 'x',
  numericConstraints: [], relatedNormIds: [], relatedScreenIds: [],
  status: 'planned', notes: null, title: 'No new core mechanics.',
};
for (let i = 0; i < 100; i += 1) {
  REQS.push({ ...sample, id: 'REQ-TEMP-A-' + String(i).padStart(4, '0') });
}
const out = { schemaVersion: '1.0', chunk: 'a', chapterRange: { lo: 1, hi: 29 }, requirements: REQS, contextOnly: [] };
const text = JSON.stringify(out, null, 2);
await writeFile('tools/requirements/_est.json', text, 'utf8');
console.log('lines:', text.split('\n').length, 'bytes:', text.length);