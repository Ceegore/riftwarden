import { readFile } from 'node:fs/promises';
const j = JSON.parse(await readFile('docs/requirements/requirements/_staging/chunk-b.json', 'utf8'));
const ch30 = j.requirements.filter(r => r.source.chapter === 30).slice(0, 3);
console.log(JSON.stringify(ch30, null, 2));