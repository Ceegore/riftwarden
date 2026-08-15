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
