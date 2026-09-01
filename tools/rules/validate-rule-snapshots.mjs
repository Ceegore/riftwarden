#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { validateRegistry } from './lib/rule-snapshots.mjs';

const root = resolve(process.argv[2] ?? '.');
const contractsDir = join(root, 'contracts', 'rules');
const required = ['rule-authority-registry.json', 'technical-rules.snapshot.json', 'ui-rules.snapshot.json', 'save-rules.snapshot.json', 'game-rules.snapshot.json'];
if (!existsSync(contractsDir) || required.some((p) => !existsSync(join(contractsDir, p)))) {
  console.log(JSON.stringify({ schemaVersion: 1, status: 'BLOCKED', diagnostics: [{ code: 'P11_RULE_SNAPSHOT_DRIFT', path: 'contracts/rules', message: 'rule contracts missing' }] }, null, 2));
  process.exitCode = 2;
} else {
  const j = (p) => JSON.parse(readFileSync(join(contractsDir, p), 'utf8'));
  const registry = j('rule-authority-registry.json');
  const snapshots = {
    'technical-rules.ts': j('technical-rules.snapshot.json'),
    'ui-rules.ts': j('ui-rules.snapshot.json'),
    'save-rules.ts': j('save-rules.snapshot.json'),
    'game-rules.ts': j('game-rules.snapshot.json')
  };
  const diagnostics = validateRegistry(registry, snapshots);
  console.log(JSON.stringify({ schemaVersion: 1, status: diagnostics.length ? 'BLOCKED' : 'PASS', diagnostics }, null, 2));
  process.exitCode = diagnostics.length ? 2 : 0;
}
