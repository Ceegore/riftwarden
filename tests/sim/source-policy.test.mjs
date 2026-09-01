import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
// §12 source policy applies to the whole sim kernel (Phases 13–18 modules:
// core/events/scheduler/snapshot plus random, math, geometry, movement,
// spawn, anti-stuck, targeting, attack, projectile, combat, status, replay).
const kernelDirs = [resolve(root, 'src', 'game', 'sim')];
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

test('Phase 18 §14 status module budgets are respected', () => {
  const budgets = {
    'status-instance.ts': 240,
    'status-collection.ts': 280,
    'status-stacking.ts': 300,
    'periodic-status-system.ts': 280,
    'control-resolver.ts': 280,
    'cleanse-dispel.ts': 260,
    'status-events.ts': 220,
    'selectors.ts': 220,
  };
  for (const [name, budget] of Object.entries(budgets)) {
    const p = join(root, 'src', 'game', 'sim', 'status', name);
    const lines = readFileSync(p, 'utf8').split(/\r?\n/).length;
    assert.ok(lines <= budget, `${name} has ${lines} lines (budget ${budget})`);
  }
});

test('Phase 21 §13 module budgets are respected', () => {
  const budgets = {
    'boss-phase-system.ts': 300,
    'boss-object-manager.ts': 280,
    'modifier-system.ts': 300,
    'hazard-system.ts': 300,
    'combat-objective.ts': 280,
    'reinforcement-system.ts': 260,
  };
  const dirs = ['boss', 'world', 'objectives'];
  for (const [name, budget] of Object.entries(budgets)) {
    let p;
    for (const d of dirs) {
      const candidate = join(root, 'src', 'game', 'sim', d, name);
      if (existsSync(candidate)) { p = candidate; break; }
    }
    assert.ok(p, `could not locate ${name}`);
    const lines = readFileSync(p, 'utf8').split(/\r?\n/).length;
    assert.ok(lines <= budget, `${name} has ${lines} lines (budget ${budget})`);
  }
});

test('Phase 20 §10 module budgets are respected', () => {
  const budgets = {
    'synergy-counter.ts': 240,
    'synergy-runtime.ts': 300,
    'summon-manager.ts': 300,
    'summon-lifecycle.ts': 260,
    'construct-manager.ts': 300,
    'temporary-registry.ts': 280,
  };
  const dirs = ['synergy', 'summon'];
  for (const [name, budget] of Object.entries(budgets)) {
    let p;
    for (const d of dirs) {
      const candidate = join(root, 'src', 'game', 'sim', d, name);
      if (existsSync(candidate)) { p = candidate; break; }
    }
    assert.ok(p, `could not locate ${name}`);
    const lines = readFileSync(p, 'utf8').split(/\r?\n/).length;
    assert.ok(lines <= budget, `${name} has ${lines} lines (budget ${budget})`);
  }
});
