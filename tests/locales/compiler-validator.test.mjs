import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProject } from '../../tools/locales/lib/validator-core.mjs';
import { compileProject } from '../../tools/locales/lib/compiler-core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const valid = path.join(here, 'fixtures/valid');

async function cloneFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'riftwarden-l10n-'));
  await cp(valid, root, { recursive:true });
  return root;
}

async function mutateEnglish(mutator) {
  const root = await cloneFixture();
  const file = path.join(root, 'src/locales/messages/en/ui-test.messages.json');
  const doc = JSON.parse(await readFile(file, 'utf8'));
  mutator(doc);
  await writeFile(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return root;
}

test('valid fixture passes release validation and compiles deterministically', async () => {
  const first = await validateProject(valid, 'release');
  assert.equal(first.status, 'PASS', JSON.stringify(first, null, 2));
  const a = await compileProject(valid, 'release');
  const b = await compileProject(valid, 'release');
  assert.equal(a.get('de').body, b.get('de').body);
  assert.equal(a.get('en').sha256, b.get('en').sha256);
});

const negativeCases = [
  ['missing key', doc => { delete doc.messages['ui.test.mode']; }, 'L10N_KEY_MISSING'],
  ['extra key', doc => { doc.messages['ui.test.extra'] = structuredClone(doc.messages['ui.test.mode']); }, 'L10N_KEY_EXTRA'],
  ['syntax', doc => { doc.messages['ui.test.mode'].message = '{mode, select, safe {Safe}}'; }, 'L10N_GRAMMAR_MISSING_OTHER'],
  ['parameter kind', doc => { doc.messages['ui.test.number'].message = '{value} points'; }, 'L10N_PARAMETER_MISMATCH'],
  ['branch mismatch', doc => { doc.messages['ui.test.mode'].message = '{mode, select, compact {Compact} other {Normal}}'; }, 'L10N_CONTROL_MISMATCH'],
  ['token mismatch', doc => { doc.messages['ui.test.rich'].message = 'Try again'; }, 'L10N_TOKEN_MISMATCH'],
  ['placeholder', doc => { doc.messages['ui.test.mode'].message = 'TODO'; }, 'L10N_PLACEHOLDER'],
  ['budget', doc => { doc.messages['ui.test.mode'].message = 'X'.repeat(201); }, 'L10N_BUDGET_EXCEEDED'],
  ['unapproved', doc => { doc.messages['ui.test.mode'].review = { status:'draft', source:'fixture', reviewer:null, reviewedAt:null }; }, 'L10N_UNAPPROVED_COPY'],
  ['markup', doc => { doc.messages['ui.test.mode'].message = '<b>unsafe</b>'; }, 'L10N_FORBIDDEN_MARKUP'],
  ['glossary', doc => { doc.messages['ui.test.mode'].message = 'Use a rift portal'; }, 'L10N_GLOSSARY_FORBIDDEN_VARIANT'],
];

for (const [name, mutate, code] of negativeCases) {
  test(`release validator blocks ${name}`, async () => {
    const root = await mutateEnglish(mutate);
    const report = await validateProject(root, 'release');
    assert.equal(report.status, 'FAIL');
    assert.ok(report.errors.some(error => error.code === code), JSON.stringify(report, null, 2));
  });
}
