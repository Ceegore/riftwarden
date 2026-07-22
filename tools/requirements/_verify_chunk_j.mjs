// Verify chunk-j: JSON validity, schema-ish checks, hash recompute
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const file = 'docs/requirements/requirements/_staging/chunk-j.json';
const data = JSON.parse(readFileSync(file, 'utf8'));

const validNorms = ['MUST', 'MUST_NOT', 'SHOULD', 'MAY'];
const validCats = ['Product', 'Content', 'Sim', 'UX', 'Save', 'A11y', 'Perf', 'Security', 'Android', 'iOS', 'Store', 'QA'];
const validStatus = ['planned', 'implemented', 'verified', 'blocked', 'deferred_by_spec'];
const idPattern = /^REQ-TEMP-J-\d{4}$/;
const phasePattern = /^PHASE-(0[0-9]|[1-4][0-9])$/;

let errors = 0;
const seen = new Set();

for (const [i, r] of data.requirements.entries()) {
  const tag = `req[${i}](${r.id || 'NO_ID'})`;
  if (!idPattern.test(r.id || '')) { console.error(`${tag}: bad id`); errors++; }
  if (seen.has(r.id)) { console.error(`${tag}: duplicate id`); errors++; }
  seen.add(r.id);
  if (!r.title || r.title.length < 3) { console.error(`${tag}: bad title`); errors++; }
  if (!r.statement || r.statement.length < 10) { console.error(`${tag}: bad statement`); errors++; }
  if (!validNorms.includes(r.norm)) { console.error(`${tag}: bad norm ${r.norm}`); errors++; }
  if (!validCats.includes(r.category)) { console.error(`${tag}: bad category ${r.category}`); errors++; }
  const s = r.source || {};
  if (!s.sourceId) { console.error(`${tag}: missing sourceId`); errors++; }
  if (typeof s.chapter !== 'number' || s.chapter < 1 || s.chapter > 87) { console.error(`${tag}: bad chapter ${s.chapter}`); errors++; }
  if (!s.locator || s.locator.length < 1) { console.error(`${tag}: missing locator`); errors++; }
  if (!/^sha256:[a-f0-9]{64}$/.test(s.quoteHash || '')) { console.error(`${tag}: bad quoteHash ${s.quoteHash}`); errors++; }
  if (!s.originalExcerpt || s.originalExcerpt.length < 1) { console.error(`${tag}: missing originalExcerpt`); errors++; }
  const recomputed = `sha256:${createHash('sha256').update(s.originalExcerpt).digest('hex')}`;
  if (recomputed !== s.quoteHash) { console.error(`${tag}: quoteHash mismatch`); errors++; }
  if (!Array.isArray(r.ownerPhases) || r.ownerPhases.length < 1) { console.error(`${tag}: bad ownerPhases`); errors++; }
  for (const p of r.ownerPhases || []) if (!phasePattern.test(p)) { console.error(`${tag}: bad phase ${p}`); errors++; }
  if (!Array.isArray(r.verification) || r.verification.length < 1) { console.error(`${tag}: bad verification`); errors++; }
  for (const v of r.verification || []) {
    if (!['unit', 'property', 'golden', 'integration', 'e2e', 'visual', 'native', 'manual', 'review', 'static'].includes(v.type)) { console.error(`${tag}: bad v.type ${v.type}`); errors++; }
    if (!phasePattern.test(v.plannedPhase || '')) { console.error(`${tag}: bad v.plannedPhase`); errors++; }
    if (!Array.isArray(v.testIds) || v.testIds.length < 1) { console.error(`${tag}: bad v.testIds`); errors++; }
  }
  if (!Array.isArray(r.relatedNormIds)) { console.error(`${tag}: bad relatedNormIds`); errors++; }
  if (!Array.isArray(r.relatedScreenIds)) { console.error(`${tag}: bad relatedScreenIds`); errors++; }
  if (!validStatus.includes(r.status)) { console.error(`${tag}: bad status ${r.status}`); errors++; }
}

// chunk metadata
if (data.schemaVersion !== '1.0') { console.error('bad schemaVersion'); errors++; }
if (data.chunk !== 'j') { console.error('bad chunk'); errors++; }
if (data.chapterRange?.lo !== 36 || data.chapterRange?.hi !== 41) { console.error('bad chapterRange'); errors++; }

// uniqueness of testIds across all reqs
const testIds = new Map();
for (const r of data.requirements) {
  for (const v of r.verification) {
    for (const t of v.testIds) {
      if (testIds.has(t)) {
        if (testIds.get(t) !== r.id) {
          console.error(`testId ${t} reused across requirements ${testIds.get(t)} and ${r.id}`);
          errors++;
        }
      } else testIds.set(t, r.id);
    }
  }
}

if (errors === 0) {
  console.log(`PASS: ${data.requirements.length} requirements validated.`);
} else {
  console.error(`FAIL: ${errors} errors`);
  process.exit(1);
}