import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'tests', 'tools', 'docs'];
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.md', '.css', '.json']);
/** @type {string[]} */
const errors = [];
/**
 * Walks the directory tree and gathers TODO/FIXME/HACK violations.
 * @param {string} dir Current directory.
 */
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'generated' || entry.name === 'node_modules' || entry.name === 'lint') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (extensions.has(path.extname(entry.name))) {
      fs.readFileSync(full, 'utf8').split(/\r?\n/).forEach((line, index) => {
        const match = /\b(TODO|FIXME|HACK)\b(?!\([A-Z]+-\d+\))/.exec(line);
        if (match) errors.push(`${full}:${index + 1}: ${match[1]} requires an issue ID like ${match[1]}(RW-123).`);
      });
    }
  }
}
for (const root of roots) walk(root);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('TODO/FIXME/HACK contract passed.');
