import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMessage } from '../../tools/locales/lib/message-parser.mjs';
import { analyzeAst } from '../../tools/locales/lib/message-analysis.mjs';

test('parser supports arg, number, select, plural, exact branches and nesting', () => {
  const ast = parseMessage("{mode, select, safe {{count, plural, =0 {None} one {# item} other {# items}}} other {{value, number}}}");
  const analysis = analyzeAst(ast);
  assert.deepEqual(analysis.parameters, { count:'plural', mode:'select', value:'number' });
  assert.equal(analysis.controls.length, 2);
});

test('parser implements ICU apostrophe quoting for grammar characters', () => {
  const ast = parseMessage("Use '{name}' and '' now");
  assert.deepEqual(ast, [{ t:'text', v:"Use {name} and ' now" }]);
});

test('parser rejects unsupported formatter types', () => {
  assert.throws(() => parseMessage('{when, date}'), error => error.code === 'L10N_GRAMMAR_UNSUPPORTED_TYPE');
});

test('parser rejects pound outside plural', () => {
  assert.throws(() => parseMessage('# items'), error => error.code === 'L10N_GRAMMAR_INVALID_POUND');
});

test('parser requires other and rejects duplicate branches', () => {
  assert.throws(() => parseMessage('{x, select, a {A}}'), error => error.code === 'L10N_GRAMMAR_MISSING_OTHER');
  assert.throws(() => parseMessage('{x, select, other {A} other {B}}'), error => error.code === 'L10N_GRAMMAR_DUPLICATE_BRANCH');
});
