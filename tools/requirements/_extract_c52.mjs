import { readFileSync, writeFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('tools/requirements/_inspect_c52.json','utf8'));
let out = '';
for (let i = 1640; i <= 1665; i++) {
  const b = d.blocks[i];
  out += '=== block ' + i + ' type=' + b.type + ' ===\n';
  if (b.type === 'paragraph') {
    out += (b.text || '(empty)') + '\n';
  } else if (b.type === 'table') {
    out += JSON.stringify(b.rows, null, 2) + '\n';
  } else {
    out += JSON.stringify(b) + '\n';
  }
  out += '\n';
}
writeFileSync('tools/requirements/_c52_dump.txt', out);
console.log('wrote', out.length, 'bytes');
