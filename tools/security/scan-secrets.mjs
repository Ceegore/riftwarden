import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, walkFiles } from '../lib/fs-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root ?? '.');
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['generic-secret-assignment', /\b(?:api[_-]?key|client[_-]?secret|password|token)\s*[:=]\s*['"][^'"\n]{12,}['"]/i]
];
const denyExt = new Set(['.png','.jpg','.jpeg','.gif','.webp','.zip','.jar','.woff','.woff2','.ttf','.mp3','.ogg','.m4a']);
const findings = [];
for (const file of await walkFiles(root, { excludedNames: ['.git','node_modules','dist','artifacts','tests'] })) {
  if (denyExt.has(path.extname(file).toLowerCase())) continue;
  const text = await readFile(file, 'utf8').catch(() => null);
  if (text == null) continue;
  for (const [kind, pattern] of patterns) if (pattern.test(text)) findings.push({ file: path.relative(root, file).replaceAll('\\','/'), kind });
}
console.log(JSON.stringify({ schemaVersion: 1, ok: findings.length === 0, findings }, null, 2));
if (findings.length) process.exitCode = 1;
