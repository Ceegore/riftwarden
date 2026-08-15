import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditTree, lineSha256 } from '../../tools/rules/lib/magic-audit.mjs';
import { validatePublishedIds } from '../../tools/rules/lib/published-ids.mjs';
import { validateRegistry } from '../../tools/rules/lib/rule-snapshots.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const contractsDir = join(here, '..', '..', 'contracts', 'rules');
const j = (p) => JSON.parse(readFileSync(join(contractsDir, p), 'utf8'));

const snapshots = {
  'technical-rules.ts': j('technical-rules.snapshot.json'),
  'ui-rules.ts': j('ui-rules.snapshot.json'),
  'save-rules.ts': j('save-rules.snapshot.json'),
  'game-rules.ts': j('game-rules.snapshot.json')
};

test('rule registry valid', () => {
  assert.deepEqual(validateRegistry(j('rule-authority-registry.json'), snapshots), []);
});

test('duplicate registry owner blocks', () => {
  const r = j('rule-authority-registry.json');
  r.entries.push({ ...r.entries[0] });
  assert.ok(validateRegistry(r, snapshots).some((x) => x.code === 'P11_RULE_SOURCE_DUPLICATE'));
});

test('snapshot drift blocks', () => {
  const r = j('rule-authority-registry.json');
  const s = j('technical-rules.snapshot.json');
  s.simulationTicksPerSecond = 31;
  const drifted = {
    'technical-rules.ts': s,
    'ui-rules.ts': j('ui-rules.snapshot.json'),
    'save-rules.ts': j('save-rules.snapshot.json'),
    'game-rules.ts': j('game-rules.snapshot.json')
  };
  assert.ok(validateRegistry(r, drifted).some((x) => x.code === 'P11_RULE_SNAPSHOT_DRIFT'));
});

const fixture = (name) => join(here, 'fixtures', 'ids', name);

test('valid published transition', () => {
  assert.deepEqual(validatePublishedIds(JSON.parse(readFileSync(fixture('published.previous.json'), 'utf8')), JSON.parse(readFileSync(fixture('published.valid-next.json'), 'utf8'))), []);
});

test('removed published id blocks', () => {
  assert.ok(validatePublishedIds(JSON.parse(readFileSync(fixture('published.previous.json'), 'utf8')), JSON.parse(readFileSync(fixture('published.invalid-removed.json'), 'utf8'))).some((x) => x.code === 'P11_PUBLISHED_ID_REMOVED'));
});

test('replacement cycle blocks', () => {
  assert.ok(validatePublishedIds(JSON.parse(readFileSync(fixture('published.previous.json'), 'utf8')), JSON.parse(readFileSync(fixture('published.invalid-cycle.json'), 'utf8'))).some((x) => x.code === 'P11_REPLACEMENT_INVALID'));
});

test('type change blocks', () => {
  const prev = JSON.parse(readFileSync(fixture('published.previous.json'), 'utf8'));
  const next = JSON.parse(readFileSync(fixture('published.valid-next.json'), 'utf8'));
  next.ids[0].type = 'troop';
  assert.ok(validatePublishedIds(prev, next).some((x) => x.code === 'P11_REPLACEMENT_INVALID'));
});

test('duplicate next id blocks', () => {
  const prev = JSON.parse(readFileSync(fixture('published.previous.json'), 'utf8'));
  const next = JSON.parse(readFileSync(fixture('published.valid-next.json'), 'utf8'));
  next.ids.push({ ...next.ids[0] });
  assert.ok(validatePublishedIds(prev, next).some((x) => x.code === 'P11_ID_COLLISION'));
});

test('self-referential replacement blocks', () => {
  const prev = JSON.parse(readFileSync(fixture('published.previous.json'), 'utf8'));
  const next = JSON.parse(readFileSync(fixture('published.valid-next.json'), 'utf8'));
  next.ids[1].replacementId = 'item_old_blade';
  assert.ok(validatePublishedIds(prev, next).some((x) => x.code === 'P11_REPLACEMENT_INVALID'));
});

test('replacement into another namespace blocks', () => {
  const prev = JSON.parse(readFileSync(fixture('published.previous.json'), 'utf8'));
  const next = JSON.parse(readFileSync(fixture('published.valid-next.json'), 'utf8'));
  next.ids[1].replacementId = 'hero_new_blade';
  next.ids[2].id = 'hero_new_blade';
  next.ids[2].type = 'hero';
  assert.ok(validatePublishedIds(prev, next).some((x) => x.code === 'P11_REPLACEMENT_INVALID'));
});

test('magic global semantic duplicate blocks', () => {
  const d = mkdtempSync(join(tmpdir(), 'p11-'));
  mkdirSync(join(d, 'src'));
  writeFileSync(join(d, 'src', 'battle.ts'), 'const maxUnits = 7;\n');
  assert.equal(auditTree(d, { entries: [] })[0].code, 'P11_MAGIC_VALUE_DUPLICATE');
});

test('dataset-specific value is not false positive', () => {
  const d = mkdtempSync(join(tmpdir(), 'p11-'));
  mkdirSync(join(d, 'src'));
  writeFileSync(join(d, 'src', 'content.ts'), 'const unit = { damage: 30 };\n');
  assert.deepEqual(auditTree(d, { entries: [] }), []);
});

test('underscore-separated rule literal is detected', () => {
  const d = mkdtempSync(join(tmpdir(), 'p11-'));
  mkdirSync(join(d, 'src'));
  writeFileSync(join(d, 'src', 'battle.ts'), 'const positionMaxX100 = 10_000;\n');
  const res = auditTree(d, { entries: [] });
  assert.ok(res.some((x) => x.code === 'P11_MAGIC_VALUE_DUPLICATE' && x.message === 'hard rule literal 10000'));
});

test('rule-key-shaped consumer literals are detected', () => {
  const d = mkdtempSync(join(tmpdir(), 'p11-'));
  mkdirSync(join(d, 'src'));
  writeFileSync(join(d, 'src', 'battle.ts'), 'const renderTargetFramesPerSecond = 60;\nconst maxHeroesPerPlayerGroup = 3;\n');
  const msgs = auditTree(d, { entries: [] }).map((x) => x.message);
  assert.ok(msgs.includes('hard rule literal 60'));
  assert.ok(msgs.includes('hard rule literal 3'));
});

test('scaled literal is not reported as its base literal', () => {
  const d = mkdtempSync(join(tmpdir(), 'p11-'));
  mkdirSync(join(d, 'src'));
  writeFileSync(join(d, 'src', 'battle.ts'), 'const ticksPerSecond = 30;\nconst maxUnits = 300;\n');
  const res = auditTree(d, { entries: [] });
  const lits = res.map((x) => x.message);
  assert.ok(lits.some((m) => m === 'hard rule literal 30'), '30 must be reported');
  assert.ok(!lits.some((m) => m === 'hard rule literal 3'), '30 must not be reported as literal 3');
  assert.ok(!res.some((x) => x.path.endsWith(':2')), '300 must not be reported');
});

test('exact allowlist suppresses finding', () => {
  const d = mkdtempSync(join(tmpdir(), 'p11-'));
  mkdirSync(join(d, 'src'));
  const line = 'const maxUnits = 7;';
  writeFileSync(join(d, 'src', 'battle.ts'), line + '\n');
  const allow = {
    entries: [{ path: 'src/battle.ts', literal: 7, lineSha256: lineSha256(line), helperTraceId: 'P11-TEMP', owner: 'qa', reason: 'temporary compatibility exception', expiresOn: '9999-12-31' }]
  };
  assert.deepEqual(auditTree(d, allow), []);
});

test('allowlist entry without owner or reason blocks with P11_ALLOWLIST_INVALID', () => {
  const d = mkdtempSync(join(tmpdir(), 'p11-'));
  mkdirSync(join(d, 'src'));
  const line = 'const maxUnits = 7;';
  writeFileSync(join(d, 'src', 'battle.ts'), line + '\n');
  const base = { path: 'src/battle.ts', literal: 7, lineSha256: lineSha256(line), helperTraceId: 'P11-TEMP', owner: 'qa', reason: 'temporary compatibility exception', expiresOn: '9999-12-31' };
  const noOwner = { ...base, owner: '' };
  assert.ok(auditTree(d, { entries: [noOwner] }).some((x) => x.code === 'P11_ALLOWLIST_INVALID'));
  const shortReason = { ...base, reason: 'short' };
  assert.ok(auditTree(d, { entries: [shortReason] }).some((x) => x.code === 'P11_ALLOWLIST_INVALID'));
  const noTrace = { ...base, helperTraceId: 'X-1' };
  assert.ok(auditTree(d, { entries: [noTrace] }).some((x) => x.code === 'P11_ALLOWLIST_INVALID'));
});
