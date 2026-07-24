import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from '../lib/fs-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const outDir = args.out ?? 'artifacts/security/dependencies';
await mkdir(outDir, { recursive: true });
function run(argsList) {
  return execFileSync('pnpm', argsList, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
await writeFile(path.join(outDir, 'pnpm-list.json'), run(['list', '--json', '--depth', 'Infinity']));
await writeFile(path.join(outDir, 'pnpm-licenses.json'), run(['licenses', 'list', '--json']));
let audit;
try { audit = run(['audit', '--json']); }
catch (error) { audit = error.stdout || error.stderr || JSON.stringify({ captureError: String(error) }); }
await writeFile(path.join(outDir, 'pnpm-audit.json'), audit);
console.log(outDir);
