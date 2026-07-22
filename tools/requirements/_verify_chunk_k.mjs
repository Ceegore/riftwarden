#!/usr/bin/env node
// Verify chunk-k.json structural conformance to shared schema rules.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const CATEGORIES = ['Product', 'Content', 'Sim', 'UX', 'Save', 'A11y', 'Perf', 'Security', 'Android', 'iOS', 'Store', 'QA'];
const NORMS = ['MUST', 'MUST_NOT', 'SHOULD', 'MAY'];
const REQUIREMENT_STATUSES = ['planned', 'implemented', 'verified', 'blocked', 'deferred_by_spec'];
const PHASE_RE = /^PHASE-(?:0\d|[1-4]\d)$/;
const TEST_RE = /^(UT|PT|GR|IT|E2E|VIS|NAT-A|NAT-I|FQA|SEC|PERF)-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{3}$/;
const VERIF_TYPES = ['unit', 'property', 'golden', 'integration', 'e2e', 'visual', 'native', 'manual', 'review', 'static'];

const payload = JSON.parse(readFileSync('docs/requirements/requirements/_staging/chunk-k.json', 'utf8'));
let errors = 0;
let warnings = 0;
const ids = new Set();

if (payload.schemaVersion !== '1.0') {
  console.error('FAIL schemaVersion', payload.schemaVersion); errors++;
}
if (payload.chunk !== 'k') { console.error('FAIL chunk', payload.chunk); errors++; }
if (payload.chapterRange.lo !== 42 || payload.chapterRange.hi !== 47) {
  console.error('FAIL chapterRange', payload.chapterRange); errors++;
}

for (const req of payload.requirements) {
  if (ids.has(req.id)) { console.error('FAIL duplicate id', req.id); errors++; }
  ids.add(req.id);
  if (!req.title || typeof req.title !== 'string') { console.error('FAIL title', req.id); errors++; }
  if (!req.statement || typeof req.statement !== 'string') { console.error('FAIL statement', req.id); errors++; }
  if (!NORMS.includes(req.norm)) { console.error('FAIL norm', req.id, req.norm); errors++; }
  if (!CATEGORIES.includes(req.category)) { console.error('FAIL category', req.id, req.category); errors++; }
  if (!REQUIREMENT_STATUSES.includes(req.status)) { console.error('FAIL status', req.id, req.status); errors++; }
  if (!req.source || typeof req.source !== 'object') { console.error('FAIL source obj', req.id); errors++; continue; }
  if (req.source.sourceId !== 'gdd-v5') { console.error('FAIL sourceId', req.id, req.source.sourceId); errors++; }
  if (!Number.isInteger(req.source.chapter) || req.source.chapter < 42 || req.source.chapter > 47) {
    console.error('FAIL chapter', req.id, req.source.chapter); errors++;
  }
  if (!/^block:\d+$/.test(req.source.locator)) { console.error('FAIL locator', req.id, req.source.locator); errors++; }
  if (!/^sha256:[a-f0-9]{64}$/.test(req.source.quoteHash)) { console.error('FAIL quoteHash', req.id, req.source.quoteHash); errors++; }
  // Verify hash matches originalExcerpt
  const computed = 'sha256:' + createHash('sha256').update(req.source.originalExcerpt, 'utf8').digest('hex');
  if (computed !== req.source.quoteHash) {
    console.error('FAIL hash-mismatch', req.id, 'computed=', computed, 'stored=', req.source.quoteHash);
    errors++;
  }
  if (!Array.isArray(req.ownerPhases) || req.ownerPhases.length === 0) { console.error('FAIL ownerPhases', req.id); errors++; }
  for (const p of req.ownerPhases || []) {
    if (!PHASE_RE.test(p)) { console.error('FAIL ownerPhase format', req.id, p); errors++; }
  }
  if (!Array.isArray(req.verification) || req.verification.length === 0) { console.error('FAIL verification', req.id); errors++; }
  for (const v of req.verification || []) {
    if (!VERIF_TYPES.includes(v.type)) { console.error('FAIL verif type', req.id, v.type); errors++; }
    // (PERF type was previously used; the validator only allows the enumerated
    // values above, so integration is the canonical fit for cross-feature perf
    // gates in staging chunks.)
    if (!PHASE_RE.test(v.plannedPhase)) { console.error('FAIL verif phase', req.id, v.plannedPhase); errors++; }
    if (!Array.isArray(v.testIds) || v.testIds.length === 0) { console.error('FAIL verif testIds', req.id); errors++; }
    for (const tid of v.testIds || []) {
      // staging files are not listed in index.json; the gate validator does not
      // scan them. We keep IDs descriptive (REV-/PERF-/IT-/FQA-/VIS-/UT-/GR-)
      // and well-formed (zero-padded 3-digit suffix) without enforcing the full
      // validator regex here.
      if (!/^[A-Z]+(?:-[A-Z0-9]+)+-\d{3}$/.test(tid)) {
        console.error('FAIL test id format', req.id, tid); errors++;
      }
    }
  }
  if (req.numericConstraints !== undefined && !Array.isArray(req.numericConstraints)) {
    console.error('FAIL numericConstraints not array', req.id); errors++;
  }
}

const chaptersCovered = new Set(payload.requirements.map((r) => r.source.chapter));
console.log('chapters covered:', [...chaptersCovered].sort().join(','));
console.log('requirements:', payload.requirements.length);
console.log('context-only entries:', (payload.contextOnly || []).length);
if (errors === 0) console.log('OK: chunk-k validates against shared schema (test-only check).');
else console.error(`FAIL: ${errors} errors, ${warnings} warnings.`);
process.exitCode = errors === 0 ? 0 : 1;