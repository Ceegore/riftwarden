#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const cfgPath = join(root, 'config', 'roll-slots.dev.json');
if (!existsSync(cfgPath)) {
  console.log(JSON.stringify({ status: 'FAIL', errors: ['config/roll-slots.dev.json missing'] }, null, 2));
  process.exitCode = 1;
} else {
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const keys = new Set();
  const validStreams = new Set(['map', 'encounter', 'rewards', 'eventChoices', 'combatCosmetic']);
  const errors = [];
  if (cfg.devOnly !== true) errors.push('fixture must remain devOnly');
  for (const slot of cfg.slots) {
    if (keys.has(slot.key)) errors.push(`duplicate:${slot.key}`);
    keys.add(slot.key);
    if (!/^[a-z][a-z0-9]*(?:\.[a-z][A-Za-z0-9]*){2,}$/.test(slot.key)) errors.push(`key:${slot.key}`);
    if (!validStreams.has(slot.stream)) errors.push(`stream:${slot.key}`);
    if (slot.status !== 'ACTIVE') errors.push(`status:${slot.key}`);
  }
  console.log(JSON.stringify({ schemaVersion: 1, status: errors.length ? 'FAIL' : 'PASS', count: cfg.slots.length, devOnly: cfg.devOnly, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}
