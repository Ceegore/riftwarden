import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';
import { parseArgs, sha256File, walkFiles } from '../lib/fs-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const root = resolve(/** @type {string} */ (args.root ?? '.'));
const files = await walkFiles(root, { excludedNames: ['.git', 'node_modules', 'dist', 'artifacts'] });
const rows = [];
for (const file of files) rows.push({ path: relative(root, file).replaceAll('\\', '/'), sha256: await sha256File(file) });
const hash = createHash('sha256');
for (const row of rows) hash.update(`${row.path}\0${row.sha256}\n`);
const result = { schemaVersion: 1, root, sha256: hash.digest('hex'), files: rows };
console.log(JSON.stringify(result, null, 2));
