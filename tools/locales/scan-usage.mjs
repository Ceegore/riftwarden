#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from './lib/cli.mjs';
import { listFilesRecursive, loadCatalogs } from './lib/catalog.mjs';

const extensions = /\.(?:ts|tsx|js|jsx)$/u;
const keyCall = /\b(?:t|formatMessage|LocalizedText)\s*\(\s*['"]([a-z0-9_.-]+)['"]/gu;
const jsxKey = /\bmessageKey\s*=\s*['"]([a-z0-9_.-]+)['"]/gu;
const suspiciousJsxText = />\s*([A-Za-zÄÖÜäöüß][^<{]{3,})\s*</gu;

try {
  const options = parseArgs(process.argv.slice(2));
  const src = path.join(options.root, 'src');
  const files = (await listFilesRecursive(src)).filter(file => extensions.test(file) && !file.includes(`${path.sep}locales${path.sep}messages${path.sep}`));
  const usages = new Set();
  const suspicious = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const re of [keyCall, jsxKey]) {
      re.lastIndex = 0;
      for (const match of text.matchAll(re)) usages.add(match[1]);
    }
    suspiciousJsxText.lastIndex = 0;
    for (const match of text.matchAll(suspiciousJsxText)) suspicious.push({ file:path.relative(options.root, file), sample:match[1].trim().slice(0, 100) });
  }
  const { catalogs, index } = await loadCatalogs(options.root);
  const known = new Set(Object.keys(catalogs.get(index.releaseLocales[0]) ?? {}));
  const unknownKeys = [...usages].filter(key => !known.has(key)).sort();
  const result = { schemaVersion:1, status:unknownKeys.length || suspicious.length ? 'FAIL' : 'PASS', scannedFiles:files.length, usedKeys:[...usages].sort(), unknownKeys, suspiciousVisibleStrings:suspicious };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === 'PASS' ? 0 : 1;
} catch (error) {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 2;
}
