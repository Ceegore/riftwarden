import { readFile } from 'node:fs/promises';
import { parseArgs } from '../lib/fs-utils.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.base || !args.head) throw new Error('Usage: --base <license-report.json> --head <license-report.json>');
const base = JSON.parse(await readFile(args.base, 'utf8'));
const head = JSON.parse(await readFile(args.head, 'utf8'));
const key = (x) => `${x.name}@${x.version}:${x.scope}`;
const a = new Map(base.components.map((x) => [key(x), x]));
const b = new Map(head.components.map((x) => [key(x), x]));
const added = [...b].filter(([k]) => !a.has(k)).map(([, v]) => v);
const removed = [...a].filter(([k]) => !b.has(k)).map(([, v]) => v);
const result = { schemaVersion: 1, added, removed, changed: added.length + removed.length > 0 };
console.log(JSON.stringify(result, null, 2));
