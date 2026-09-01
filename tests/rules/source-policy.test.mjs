import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const here = dirname(fileURLToPath(import.meta.url));
const rulesDir = resolve(root, 'src', 'game', 'rules');
const toolsDir = resolve(root, 'tools', 'rules');
function walk(d, out = []) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const ruleFiles = walk(rulesDir).filter((x) => x.endsWith('.ts'));

test('no network API in rules', () => {
  for (const f of ruleFiles) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /\bfetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//);
  }
});

test('no HTML injection API in rules', () => {
  for (const f of ruleFiles) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /dangerouslySetInnerHTML|\.innerHTML\s*=/);
  }
});

test('no nondeterministic APIs in rules', () => {
  for (const f of ruleFiles) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /Math\.random|Date\.now|performance\.now/);
  }
});

test('human rule files <=300 lines', () => {
  for (const f of ruleFiles) {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/).length;
    assert.ok(lines <= 300, `${relative(root, f)} ${lines}`);
  }
});

test('rule modules import only sibling rule modules', () => {
  for (const f of ruleFiles) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (spec.startsWith('.')) {
        const resolved = resolve(dirname(f), spec.replace(/\.js$/, '.ts'));
        assert.ok(resolved.startsWith(rulesDir + sep), `${relative(root, f)} imports outside rules: ${spec}`);
      } else {
        assert.fail(`${relative(root, f)} imports bare module '${spec}' — rule modules may only import sibling rule modules`);
      }
    }
  }
});

test('rules tooling has no network, clock or random APIs', () => {
  const toolFiles = readdirSync(toolsDir, { recursive: true }).filter((x) => String(x).endsWith('.mjs'));
  for (const name of toolFiles) {
    const code = readFileSync(join(toolsDir, String(name)), 'utf8');
    assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|WebSocket|Math\.random|Date\.now|performance\.now/);
  }
});
