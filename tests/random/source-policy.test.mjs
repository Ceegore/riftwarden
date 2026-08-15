import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const randomDir = resolve(root, 'src', 'game', 'sim', 'random');
const replayDir = resolve(root, 'src', 'game', 'replay');
const allowedDirs = [randomDir, replayDir];
function files(d, out = []) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) files(p, out);
    else out.push(p);
  }
  return out;
}
const allFiles = allowedDirs.flatMap((d) => files(d)).filter((x) => x.endsWith('.ts'));

test('no Math.random, wall clock or dynamic slots in random/replay modules', () => {
  for (const f of allFiles) {
    const s = readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /Math\.random\s*\(/, f);
    assert.doesNotMatch(s, /Date\.now\s*\(/, f);
    assert.doesNotMatch(s, /draw\s*\(\s*`[^`]*\$\{/, f);
  }
});

test('random/replay modules import only allowed layers', () => {
  for (const f of allFiles) {
    const src = readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /react|zustand|pixi|capacitor|localization|renderer/, f);
    for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (spec.startsWith('.')) {
        const resolved = resolve(dirname(f), spec.replace(/\.js$/, '.ts'));
        const inside = allowedDirs.some((d) => resolved.startsWith(d + sep)) || resolved.startsWith(resolve(root, 'src', 'game', 'rules') + sep) || resolved.startsWith(resolve(root, 'src', 'game', 'sim', 'math') + sep);
        assert.ok(inside, `${f} imports outside allowed layers: ${spec}`);
      } else {
        assert.fail(`${f} imports bare module '${spec}'`);
      }
    }
  }
});

test('random/replay module line budgets', () => {
  for (const f of allFiles) {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/).length;
    assert.ok(lines <= 300, `${f} has ${lines} lines`);
  }
});
