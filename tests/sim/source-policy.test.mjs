import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const kernelDirs = ['core', 'events', 'scheduler', 'snapshot'].map((d) => resolve(root, 'src', 'game', 'sim', d));
const allowedDirs = [resolve(root, 'src', 'game', 'sim'), resolve(root, 'src', 'game', 'rules')];

function files(d, out = []) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) files(p, out);
    else out.push(p);
  }
  return out;
}

const allFiles = kernelDirs.flatMap((d) => files(d)).filter((x) => x.endsWith('.ts'));

test('kernel source has no UI/native/wallclock/random/locale-sort authority', () => {
  const banned = [
    /from\s+['"](?:react|pixi|@capacitor|.*platform|.*navigation|.*storage|.*renderer|.*localization)/,
    /\bDate\.now\s*\(|\bperformance\.now\s*\(/,
    /\bMath\.random\s*\(/,
    /\brequestAnimationFrame\s*\(/,
    /\bsetTimeout\s*\(|\bsetInterval\s*\(/,
    /\.localeCompare\s*\(|\bIntl\b/,
  ];
  for (const f of allFiles) {
    const s = readFileSync(f, 'utf8');
    for (const pattern of banned) assert.doesNotMatch(s, pattern, f);
  }
});

test('kernel modules import only relative modules within the sim/rules layers', () => {
  for (const f of allFiles) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (spec.startsWith('.')) {
        const resolved = resolve(dirname(f), spec.replace(/\.js$/, '.ts'));
        const inside = allowedDirs.some((d) => resolved.startsWith(d + sep));
        assert.ok(inside, `${f} imports outside allowed layers: ${spec}`);
      } else {
        assert.fail(`${f} imports bare module '${spec}'`);
      }
    }
  }
});

test('kernel module line budgets stay within the handbook target', () => {
  for (const f of allFiles) {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/).length;
    assert.ok(lines <= 300, `${f} has ${lines} lines`);
  }
});
