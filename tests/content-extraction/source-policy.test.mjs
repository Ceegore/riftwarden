import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const roots = [path.resolve('tools/content/extraction'), path.resolve('tools/content/verify-build-reproducibility.mjs')];

function filesIn(dir) {
  if (dir.endsWith('.mjs')) return [dir];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesIn(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}

const policyFiles = roots.flatMap(filesIn).filter((f) => f.endsWith('.mjs'));
const code = policyFiles.map((f) => readFileSync(f, 'utf8')).join('\n');

test('extraction tooling uses no network APIs', () => {
  assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//);
});

test('extraction tooling uses no HTML injection APIs', () => {
  assert.doesNotMatch(code, /dangerouslySetInnerHTML|innerHTML\s*=/);
});

test('extraction tooling uses no nondeterministic clock or random', () => {
  assert.doesNotMatch(code, /Math\.random|Date\.now/);
});

test('generated ledgers are separate from content/source output', () => {
  const ledgerDir = path.resolve('docs/reports/content-ledger');
  assert.equal(ledgerDir.includes('content/source'), false);
  const files = filesIn(ledgerDir).map((f) => path.relative(process.cwd(), f).replace(/\\/g, '/'));
  assert.equal(files.some((f) => f.includes('content/source')), false);
});

test('human-maintained extraction code files stay at or below 300 lines', () => {
  const offenders = policyFiles.filter((f) => readFileSync(f, 'utf8').split(/\r?\n/).length > 300);
  assert.deepEqual(offenders.map((f) => path.relative(process.cwd(), f)), []);
});
