import fs from 'node:fs';
import { collect, normalizedText } from './format-lib.mjs';
const errors=[];
for (const file of collect('.')) {
  const source=fs.readFileSync(file,'utf8');
  if (source !== normalizedText(file)) errors.push(file);
}
if (errors.length) { console.error(`Formatting differs:\n${errors.join('\n')}`); process.exit(1); }
console.log('Text normalization format check passed.');
