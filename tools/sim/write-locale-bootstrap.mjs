#!/usr/bin/env node
/**
 * Writes the bootstrap locale bundle (src/locales/format/bootstrap-bundle.ts)
 * from every localization key currently referenced in the app source.
 *
 * Scans:
 *   - literal labelKey="..." / nameKey="..." attributes in .tsx files
 *   - the three dynamic key templates (ui.event.<optionId>,
 *     ui.merchant.<offerId>, ui.recruit.<offerId>) expanded against the
 *     Phase 32 content fixtures so every runtime key has a message.
 *
 * The bundle is a stopgap so the app can boot in a browser before the real
 * localization compiler lands: each key maps to a readable fallback text
 * derived from the key. Regenerate with:
 *   node tools/sim/write-locale-bootstrap.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const OUT = join(root, 'src', 'locales', 'format', 'bootstrap-bundle.ts');

/** Read a file relative to the repo root. */
function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

/** Run rg for a quoted-value pattern over src and return the unique values. */
function collectValues(pattern, cwdDir = join(root, 'src')) {
  let out = '';
  try {
    out = execFileSync('rg', ['-o', pattern, '--no-filename', cwdDir], { encoding: 'utf8' });
  } catch {
    // rg exits 1 when there are no matches — that is fine.
    return new Set();
  }
  const values = new Set();
  for (const line of out.split('\n')) {
    const m = /^[a-zA-Z_]+="([^"]+)"$/.exec(line.trim());
    const m2 = /^[a-zA-Z_]+: '([^']+)'$/.exec(line.trim());
    const m3 = /^[a-zA-Z_]+: `([^`]+)`$/.exec(line.trim());
    const m4 = /^'([^']+)'$/.exec(line.trim());
    const match = m ?? m2 ?? m3 ?? m4;
    if (match) values.add(match[1]);
  }
  return values;
}

/** Expand the dynamic key templates against the Phase 32 content fixtures. */
function expandDynamicKeys() {
  const keys = new Set();
  const events = JSON.parse(read('contracts/phase32/fixtures/events-30.json'));
  for (const event of Object.values(events)) {
    for (const option of event.options ?? []) {
      if (typeof option.optionId === 'string') keys.add(`ui.event.${option.optionId}`);
    }
  }
  const merchants = JSON.parse(read('contracts/phase32/fixtures/merchant-cases.json'));
  for (const offer of merchants.offers ?? []) {
    if (typeof offer.offerId === 'string') keys.add(`ui.merchant.${offer.offerId}`);
  }
  const recruitment = JSON.parse(read('contracts/phase32/fixtures/recruitment-cases.json'));
  for (const offer of recruitment.offers ?? []) {
    if (typeof offer.offerId === 'string') keys.add(`ui.recruit.${offer.offerId}`);
  }
  return keys;
}

/** Turn "ui.common.start" into a readable "Start" label. */
function humanize(key) {
  const last = key.split('.').at(-1) ?? key;
  return last
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Parameterized UI templates (LOCALE_BOOTSTRAP_PARAMS). The bootstrap bundle is
 * a stopgap: every key maps to a readable fallback. Keys listed here get a REAL
 * compiled template (`text {arg} text`) with declared parameter kinds, so the
 * dev bundle renders parameterized UI identically to the compiled pipeline
 * instead of throwing L10N_RUNTIME_EXTRA_PARAMETER.
 */
const PARAM_TEMPLATES = Object.freeze({
  'ui.phase21.outbound.count': Object.freeze({ template: '{count} encounters · {failed} failed', parameters: Object.freeze({ count: 'number', failed: 'number' }) }),
  'ui.phase21.meta.objective': Object.freeze({ template: 'objective {objective}', parameters: Object.freeze({ objective: 'string' }) }),
  'ui.phase21.meta.terminal': Object.freeze({ template: 'objective {objective} · {phase} · {ticks} ticks', parameters: Object.freeze({ objective: 'string', phase: 'string', ticks: 'number' }) }),
  'ui.phase21.meta.terminal_reason': Object.freeze({ template: 'objective {objective} · {phase} ({reason}) · {ticks} ticks', parameters: Object.freeze({ objective: 'string', phase: 'string', reason: 'string', ticks: 'number' }) }),
  'ui.phase21.telegraph.pending': Object.freeze({ template: 'telegraph → {phase} · resolves in {ticks} ticks', parameters: Object.freeze({ phase: 'string', ticks: 'number' }) }),
  'ui.phase21.telegraph.resolved': Object.freeze({ template: 'telegraph → {phase} · resolved @ {tick}', parameters: Object.freeze({ phase: 'string', tick: 'number' }) }),
  'ui.phase21.hook.at': Object.freeze({ template: '{hook} @ {tick}', parameters: Object.freeze({ hook: 'string', tick: 'number' }) }),
  'ui.phase21.trace.at': Object.freeze({ template: '@ {tick}', parameters: Object.freeze({ tick: 'number' }) }),
  'ui.phase21.heal.applied': Object.freeze({ template: 'heal {target} +{healDelta}', parameters: Object.freeze({ target: 'string', healDelta: 'number' }) }),
  'ui.phase21.heal.blocked': Object.freeze({ template: 'lifesteal blocked on {target} ({healDelta} suppressed)', parameters: Object.freeze({ target: 'string', healDelta: 'number' }) }),
});

/** Compiles an ICU-ish template (`text {arg} text`) into compiled AST nodes + declared parameter kinds. */
function compileTemplate(template, parameters) {
  const ast = [];
  const re = /\{([a-z][a-z0-9_]*)\}/g;
  let last = 0;
  let match;
  while ((match = re.exec(template)) !== null) {
    const name = match[1];
    if (name !== undefined && !Object.hasOwn(parameters, name)) throw new Error(`bootstrap template ${template} references undeclared param {${name}}`);
    const before = template.slice(last, match.index);
    if (before.length > 0) ast.push({ t: 'text', v: before });
    if (name !== undefined) ast.push({ t: 'arg', n: name });
    last = re.lastIndex;
  }
  const tail = template.slice(last);
  if (tail.length > 0) ast.push({ t: 'text', v: tail });
  return Object.freeze({ ast: Object.freeze(ast), parameters: Object.freeze({ ...parameters }) });
}

const keys = new Set();
for (const value of collectValues('labelKey="([^"]+)"')) keys.add(value);
for (const value of collectValues('nameKey="([^"]+)"')) keys.add(value);
for (const value of collectValues('messageKey="([^"]+)"')) keys.add(value);
// Object-literal keys like labelKey: 'ui.expedition.engage' and
// dynamic templates like `ui.merchant.${offerId}`.
for (const value of collectValues("labelKey: '([^']+)'")) keys.add(value);
for (const value of collectValues("nameKey: '([^']+)'")) keys.add(value);
for (const value of collectValues("messageKey: '([^']+)'")) keys.add(value);
for (const value of collectValues('labelKey: `([^`]+)`')) keys.add(value);
for (const value of collectValues('nameKey: `([^`]+)`')) keys.add(value);
// Bare `ui.*` string literals anywhere in src (e.g. the trace-label map values
// and fallbacks) — a superset of the attribute scans, so every referenced key
// has a readable fallback message.
for (const value of collectValues("'ui\\.[a-z0-9_.-]+'")) keys.add(value);
for (const value of expandDynamicKeys()) keys.add(value);
const ALL_KEYS = [...keys].sort();

function nodeToTs(node) {
  if (node.t === 'text') return `{ t: 'text' as const, v: ${JSON.stringify(node.v)} }`;
  return `{ t: 'arg' as const, n: ${JSON.stringify(node.n)} }`;
}

function parametersToTs(parameters) {
  const entries = Object.entries(parameters).map(([name, kind]) => ` ${JSON.stringify(name)}: '${kind}'`).join(',');
  return entries.length === 0 ? '{}' : `{${entries} }`;
}

const generatedAt = new Date().toISOString();
const body = ALL_KEYS
  .map((key) => {
    const param = PARAM_TEMPLATES[key];
    if (param === undefined) {
      return `  ${JSON.stringify(key)}: Object.freeze({
    ast: Object.freeze([{ t: 'text' as const, v: ${JSON.stringify(humanize(key))} }]),
    parameters: Object.freeze({}),
    budget: '0',
    compactKey: null,
  }),`;
    }
    const compiled = compileTemplate(param.template, param.parameters);
    const astTs = compiled.ast.map(nodeToTs).join(', ');
    return `  ${JSON.stringify(key)}: Object.freeze({
    ast: Object.freeze([${astTs}]),
    parameters: Object.freeze(${parametersToTs(compiled.parameters)}),
    budget: '0',
    compactKey: null,
  }),`;
  })
  .join('\n');

const content = `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node tools/sim/write-locale-bootstrap.mjs
 * Generated at: ${generatedAt}
 *
 * Bootstrap locale bundle (LOCALE_BOOTSTRAP_CONTRACT): a stopgap bundle that
 * lets the app boot in a browser before the real localization compiler
 * pipeline lands. Every key currently referenced in the app source maps to a
 * readable fallback label. Missing keys are a failing unit test.
 */
import type { CompiledBundle, LocaleId } from './compiled-types.js';

const MESSAGES: Readonly<Record<string, import('./compiled-types.js').CompiledMessage>> = Object.freeze({
${body}
});

export const BOOTSTRAP_BUNDLES: Readonly<Record<LocaleId, CompiledBundle>> = Object.freeze({
  en: Object.freeze({ schemaVersion: 1, locale: 'en', kind: 'release_locale_bundle', messages: MESSAGES }),
  de: Object.freeze({ schemaVersion: 1, locale: 'de', kind: 'release_locale_bundle', messages: MESSAGES }),
  'qps-ploc': Object.freeze({ schemaVersion: 1, locale: 'qps-ploc', kind: 'generated_test_only_locale_bundle', messages: MESSAGES }),
});
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, content, 'utf8');
console.log(`Bootstrap bundle written: ${ALL_KEYS.length} keys -> ${OUT}`);
