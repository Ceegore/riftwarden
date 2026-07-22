import fs from 'node:fs';
import { collect, normalizedText } from './format-lib.mjs';
let count = 0;
for (const file of collect('.')) {
  const next = normalizedText(file);
  if (fs.readFileSync(file, 'utf8') !== next) {
    fs.writeFileSync(file, next, 'utf8');
    count += 1;
  }
}
console.log(`Normalized ${count} files.`);
