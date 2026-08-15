import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mathDir = resolve(here, '..', '..', 'src', 'game', 'sim', 'math');
const rulesDir = resolve(here, '..', '..', 'src', 'game', 'rules');
function files(d, out = []) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) files(p, out);
    else out.push(p);
  }
  return out;
}
const mathFiles = files(mathDir).filter((x) => x.endsWith('.ts'));

test('no local Math.round or float tolerance in math modules', () => {
  for (const f of mathFiles) {
    const name = f.replace(/\\/g, '/').split('/').pop();
    const s = readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /Math\.round\s*\(/, name);
    assert.doesNotMatch(s, /toBeCloseTo|epsilon|EPSILON/, name);
    assert.doesNotMatch(s, /\|\s*0|~~/, name);
  }
});

test('no forbidden layer imports in math modules', () => {
  for (const f of mathFiles) {
    const name = f.replace(/\\/g, '/').split('/').pop();
    assert.doesNotMatch(readFileSync(f, 'utf8'), /react|zustand|pixi|capacitor|localization|renderer/, name);
  }
});

test('math modules import only rules or own helpers', () => {
  for (const f of mathFiles) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (spec.startsWith('.')) {
        const resolved = resolve(dirname(f), spec.replace(/\.js$/, '.ts'));
        const insideMath = resolved.startsWith(mathDir + sep);
        const insideRules = resolved.startsWith(rulesDir + sep);
        assert.ok(insideMath || insideRules, `${f} imports outside rules/math: ${spec}`);
      } else {
        assert.fail(`${f} imports bare module '${spec}'`);
      }
    }
  }
});

test('math module line budgets', () => {
  const budget = {
    'invariant-error.ts': 100,
    'numeric-validation.ts': 180,
    'rounding.ts': 180,
    'fixed-math.ts': 260,
    'combat-formulas.ts': 280,
    'time-and-speed.ts': 240,
    'index.ts': 80
  };
  for (const f of mathFiles) {
    const name = f.replace(/\\/g, '/').split('/').pop();
    const max = budget[name];
    assert.ok(max, `unknown math file ${name}`);
    const lines = readFileSync(f, 'utf8').split(/\r?\n/).length;
    assert.ok(lines <= max, `${name}: ${lines} > ${max}`);
  }
});
