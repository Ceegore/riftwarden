import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const here = dirname(fileURLToPath(import.meta.url));
function walk(d, out = []) {
  for (const name of readdirSync(d)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const p = join(d, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = walk(root);

test('no network API', () => {
  for (const f of files.filter((x) => /src[\\/]game[\\/]rules.*\.ts$/.test(x.replaceAll('\\', '/')))) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /\bfetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//);
  }
});

test('no HTML injection API', () => {
  for (const f of files.filter((x) => /src[\\/]game[\\/]rules.*\.ts$/.test(x.replaceAll('\\', '/')))) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /dangerouslySetInnerHTML|\.innerHTML\s*=/);
  }
});

test('no nondeterministic APIs in rules', () => {
  for (const f of files.filter((x) => /src[\\/]game[\\/]rules.*\.ts$/.test(x.replaceAll('\\', '/')))) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /Math\.random|Date\.now|performance\.now/);
  }
});

test('human rule files <=300 lines', () => {
  for (const f of files.filter((x) => /src[\\/]game[\\/]rules.*\.(?:ts)$/.test(x.replaceAll('\\', '/')))) {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/).length;
    assert.ok(lines <= 300, `${relative(root, f)} ${lines}`);
  }
});

test('rules tooling has no network, clock or random APIs', () => {
  const toolFiles = readdirSync(join(here, '..', '..', 'tools', 'rules'), { recursive: true }).filter((x) => String(x).endsWith('.mjs'));
  for (const name of toolFiles) {
    const code = readFileSync(join(here, '..', '..', 'tools', 'rules', String(name)), 'utf8');
    assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|WebSocket|Math\.random|Date\.now|performance\.now/);
  }
});
