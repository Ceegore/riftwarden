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

const generatedAt = new Date().toISOString();
const body = ALL_KEYS
  .map(
    (key) => `  ${JSON.stringify(key)}: Object.freeze({
    ast: Object.freeze([{ t: 'text' as const, v: ${JSON.stringify(humanize(key))} }]),
    parameters: Object.freeze({}),
    budget: '0',
    compactKey: null,
  }),`,
  )
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
