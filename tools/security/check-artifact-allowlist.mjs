import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, walkFiles } from '../lib/fs-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const policy = JSON.parse(await readFile(args.policy ?? 'ci/artifact-policy.json', 'utf8'));
const root = path.resolve(args.root ?? 'artifacts');
const files = await walkFiles(root, { excludedNames: [] }).catch(() => []);
const errors = [];
for (const file of files) {
  const rel = path.relative(process.cwd(), file).replaceAll('\\', '/');
  if (!policy.allowedRoots.some((x) => rel === x || rel.startsWith(`${x}/`))) errors.push(`${rel}: outside allowed artifact roots`);
  if (/\.(?:jks|keystore|p12|mobileprovision)$/i.test(rel) || /(?:^|\/)\.env(?:\.|$)/.test(rel)) errors.push(`${rel}: sensitive artifact forbidden`);
}
console.log(JSON.stringify({ schemaVersion: 1, ok: errors.length === 0, errors }, null, 2));
if (errors.length) process.exitCode = 1;
