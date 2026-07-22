#!/usr/bin/env node
import { extname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { listGitVisibleFiles } from './git-files.mjs';

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.scss', '.html', '.json', '.jsonc', '.md',
  '.java', '.kt', '.kts', '.swift', '.plist', '.xml', '.yml', '.yaml', '.sh', '.ps1', '.txt', '.editorconfig',
]);
const ROOT_TEXT_FILES = new Set(['.gitignore', '.gitattributes', '.npmrc', '.node-version']);

function isText(path) {
  const name = path.split('/').at(-1);
  return ROOT_TEXT_FILES.has(name) || TEXT_EXTENSIONS.has(extname(path).toLowerCase());
}

const findings = [];
for (const relative of listGitVisibleFiles(process.cwd())) {
  if (!isText(relative)) continue;
  const absolute = resolve(relative);
  if (!existsSync(absolute)) continue;
  const buffer = readFileSync(absolute);
  if (buffer.includes(0)) {
    findings.push({ code: 'TEXT_NUL', path: relative, message: 'NUL byte in text file.' });
    continue;
  }
  const text = buffer.toString('utf8');
  if (text.startsWith('\uFEFF')) findings.push({ code: 'TEXT_BOM', path: relative, message: 'UTF-8 BOM is forbidden.' });
  if (text.includes('\r\n') || text.includes('\r')) findings.push({ code: 'TEXT_CRLF', path: relative, message: 'Use LF line endings.' });
  if (text.length > 0 && !text.endsWith('\n')) findings.push({ code: 'TEXT_FINAL_NEWLINE', path: relative, message: 'Final newline is missing.' });
  const trailingLine = text.split('\n').findIndex((line) => /[ \t]+$/.test(line));
  if (trailingLine >= 0 && !relative.endsWith('.md')) {
    findings.push({ code: 'TEXT_TRAILING_SPACE', path: relative, message: `Trailing whitespace on line ${trailingLine + 1}.` });
  }
}

if (findings.length === 0) {
  process.stdout.write('Text normalization: PASS\n');
} else {
  process.stderr.write('Text normalization: FAIL\n');
  for (const finding of findings) process.stderr.write(`- ${finding.code} ${finding.path}: ${finding.message}\n`);
  process.exitCode = 1;
}
