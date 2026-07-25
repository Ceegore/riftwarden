import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileProject } from '../../tools/locales/lib/compiler-core.mjs';
import { createPseudoBundle } from '../../tools/locales/lib/pseudo.mjs';
import { analyzeAst } from '../../tools/locales/lib/message-analysis.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const valid = path.join(here, 'fixtures/valid');

test('pseudo bundle is deterministic, marked test-only and preserves structure', async () => {
  const bundles = await compileProject(valid, 'release');
  const de = JSON.parse(bundles.get('de').body);
  const first = createPseudoBundle(de);
  const second = createPseudoBundle(de);
  assert.equal(first, second);
  const pseudo = JSON.parse(first);
  assert.equal(pseudo.locale, 'qps-ploc');
  assert.equal(pseudo.kind, 'generated_test_only_locale_bundle');
  for (const key of Object.keys(de.messages)) {
    assert.deepEqual(analyzeAst(pseudo.messages[key].ast).parameters, analyzeAst(de.messages[key].ast).parameters);
    assert.deepEqual(analyzeAst(pseudo.messages[key].ast).controls, analyzeAst(de.messages[key].ast).controls);
    assert.deepEqual(analyzeAst(pseudo.messages[key].ast).tokens, analyzeAst(de.messages[key].ast).tokens);
  }
  assert.match(first, /⟦/u);
  assert.match(first, /·/u);
});
