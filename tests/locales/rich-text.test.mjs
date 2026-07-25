import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMessage } from '../../tools/locales/lib/message-parser.mjs';
import { compileRichText, assertNoForbiddenMarkup } from '../../tools/locales/lib/rich-text.mjs';

const registry = { tokens:{
  strong:{ kind:'paired', ids:['default'], allowsNesting:[] },
  action:{ kind:'paired', ids:['retry'], allowsNesting:['strong','icon'] },
  icon:{ kind:'self', ids:['warning'], allowsNesting:[] },
} };

test('RichText compiles only code-owned token ids', () => {
  const ast = compileRichText(parseMessage('[[action:retry]]Again [[icon:warning]][[/action]]'), registry);
  assert.equal(ast[0].t, 'token');
  assert.equal(ast[0].id, 'retry');
});

test('RichText rejects unknown ids and nested actions', () => {
  assert.throws(() => compileRichText(parseMessage('[[action:delete_save]]No[[/action]]'), registry), error => error.code === 'L10N_TOKEN_INVALID');
  assert.throws(() => compileRichText(parseMessage('[[action:retry]][[action:retry]]No[[/action]][[/action]]'), registry), error => error.code === 'L10N_TOKEN_INVALID');
});

test('RichText tokens cannot cross branch controls', () => {
  assert.throws(() => compileRichText(parseMessage('[[strong]]{x, select, other {A}}[[/strong]]'), registry), error => error.code === 'L10N_TOKEN_INVALID');
});

test('HTML and URL content are rejected before rendering', () => {
  assert.throws(() => assertNoForbiddenMarkup('<strong>No</strong>'), error => error.code === 'L10N_FORBIDDEN_MARKUP');
  assert.throws(() => assertNoForbiddenMarkup('https://example.com'), error => error.code === 'L10N_FORBIDDEN_MARKUP');
});
