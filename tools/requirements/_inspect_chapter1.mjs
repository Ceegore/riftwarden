import { readFile } from 'node:fs/promises';
const text = await readFile('docs/requirements/generated/chapters/chapter-01.txt', 'utf8');
const lines = text.split(/\r?\n/).filter(l => l.length > 0);
const indexEntry = JSON.parse(await readFile('docs/requirements/generated/chapter-index.json', 'utf8'));
const ch1 = indexEntry.chapters.find(c => c.chapter === 1);
console.log('Header:', ch1.blockStart, '..', ch1.blockEnd, '(', ch1.blocks, 'blocks,', ch1.lines, 'lines)');
console.log('Actual content lines:', lines.length);