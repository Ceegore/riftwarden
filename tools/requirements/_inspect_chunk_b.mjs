import { readFile } from 'node:fs/promises';
const j = JSON.parse(await readFile('docs/requirements/requirements/_staging/chunk-b.json', 'utf8'));
console.log('Total REQs:', j.requirements.length);
console.log('Chapters covered:', [...new Set(j.requirements.map(r => r.source.chapter))].sort((a, b) => a - b));
console.log('Context only:', j.contextOnly);