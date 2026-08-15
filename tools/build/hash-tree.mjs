import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { parseArgs, sha256File } from '../lib/fs-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const root = resolve(/** @type {string} */ (args.root ?? '.'));
/** @type {string[]} */
let files;
try {
  // Fingerprint the committed source: git-tracked files plus untracked non-ignored
  // files. Gitignored build outputs (android/build, .gradle, dist, ...) never pollute
  // the source-tree hash, so local builds cannot change the manifest identity.
  const listing = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '--', '.'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  files = listing.split('\n').filter(Boolean).map((p) => resolve(root, p)).filter(existsSync);
} catch {
  // Not a git checkout: fall back to the plain walk (excludes heavy standard dirs).
  const { walkFiles } = await import('../lib/fs-utils.mjs');
  files = await walkFiles(root, { excludedNames: ['.git', 'node_modules', 'dist', 'artifacts'] });
}
files.sort((a, b) => a.localeCompare(b, 'en'));
const rows = [];
for (const file of files) rows.push({ path: relative(root, file).replaceAll('\\', '/'), sha256: await sha256File(file) });
const hash = createHash('sha256');
for (const row of rows) hash.update(`${row.path}\0${row.sha256}\n`);
const result = { schemaVersion: 1, root, sha256: hash.digest('hex'), files: rows };
console.log(JSON.stringify(result, null, 2));
