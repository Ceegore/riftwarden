#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { listFiles, readText, writeJsonStdout } from './lib.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const contract = JSON.parse(await readText(path.join(root, 'native/custom-plugin-contract.json')));
const files = [
  ...await listFiles(path.join(root, 'src/platform/plugins')),
  ...await listFiles(path.join(root, 'android')),
  ...await listFiles(path.join(root, 'ios')),
].filter((file) => /\.(ts|java|swift)$/.test(file));
const corpus = (await Promise.all(files.map(async (file) => `\n// ${file}\n${await readText(file)}`))).join('\n');
const findings = [];
for (const plugin of contract.plugins) {
  for (const language of ['typescript', 'android', 'ios']) {
    const scope = language === 'typescript'
      ? files.filter((f) => f.endsWith('.ts'))
      : language === 'android'
        ? files.filter((f) => f.endsWith('.java'))
        : files.filter((f) => f.endsWith('.swift'));
    const scopedText = (await Promise.all(scope.map((f) => readText(f)))).join('\n');
    if (!scopedText.includes(plugin.name)) findings.push({ severity: 'error', plugin: plugin.name, language, message: 'Plugin name missing.' });
    for (const method of plugin.methods) {
      if (!scopedText.includes(method.name)) findings.push({ severity: 'error', plugin: plugin.name, language, method: method.name, message: 'Method missing.' });
    }
  }
}
if (!corpus.includes('NOT_IMPLEMENTED')) findings.push({ severity: 'error', message: 'Skeleton NOT_IMPLEMENTED semantics missing.' });
const report = { schemaVersion: 1, status: findings.length ? 'FAIL' : 'PASS', checkedFiles: files.length, findings };
await writeJsonStdout(report);
process.exitCode = findings.length ? 1 : 0;
