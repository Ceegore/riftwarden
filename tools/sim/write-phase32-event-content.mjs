#!/usr/bin/env node
/**
 * Regenerates src/game/expedition/events/event-content.ts from the pinned
 * kit fixture contracts/phase32/fixtures/events-30.json. The emitted module
 * is the compiled Phase 32 event content; a parity test asserts it deep-equals
 * the fixture, so content drift fails CI instead of silently changing the
 * game. The fixture sha256 is embedded in the generated header.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const fixturePath = resolve(root, 'contracts', 'phase32', 'fixtures', 'events-30.json');
const outPath = resolve(root, 'src', 'game', 'expedition', 'events', 'event-content.ts');

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const fixtureSha = createHash('sha256').update(readFileSync(fixturePath)).digest('hex');

function quote(value) {
  return `'${String(value).replaceAll("'", "\\'")}'`;
}

/** Compact single-line TS for simple JSON values (strings, numbers, arrays). */
function inline(value) {
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).map(([key, item]) => `${key}: ${inline(item)}`);
    return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
  }
  if (typeof value === 'string') return quote(value);
  return String(value);
}

const lines = [];
lines.push('/**');
lines.push(' * Compiled Phase 32 event content (30 events, EVENT_SYSTEM_CONTRACT).');
lines.push(` * GENERATED from contracts/phase32/fixtures/events-30.json (sha256 ${fixtureSha}).`);
lines.push(' * Regenerate with: node tools/sim/write-phase32-event-content.mjs');
lines.push(' * Do not hand-edit: the parity test pins this module to the fixture.');
lines.push(' */');
lines.push("import type { EventDefinition } from './event-types.js';");
lines.push('');
lines.push('export const EVENT_DEFINITIONS: readonly EventDefinition[] = [');
for (const event of fixture) {
  lines.push('  {');
  lines.push(`    eventId: ${quote(event.eventId)},`);
  lines.push(`    prerequisites: ${inline(event.prerequisites)},`);
  lines.push('    options: [');
  for (const option of event.options) {
    const fields = [
      `optionId: ${quote(option.optionId)}`,
      `labelKey: ${quote(option.labelKey)}`,
      `cost: ${inline(option.cost)}`,
      `preview: ${inline(option.preview)}`,
      `rollSlots: ${inline(option.rollSlots)}`,
    ];
    lines.push(`      { ${fields.join(', ')} },`);
  }
  lines.push('    ],');
  lines.push('  },');
}
lines.push('];');
lines.push('');

writeFileSync(outPath, lines.join('\n'));
console.log(`wrote ${outPath} (${fixture.length} events, fixture ${fixtureSha.slice(0, 12)})`);
