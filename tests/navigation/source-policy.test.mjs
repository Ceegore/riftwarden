import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const normalizedRelative = (file) => relative(root, file).split(sep).join('/');

async function walk(dir) {
  const output = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(path)));
    else output.push(path);
  }
  return output;
}

test('navigation starter contains no HTML injection or network path', async () => {
  const files = (await walk(resolve(root, 'src'))).filter((path) => /\.(ts|tsx)$/u.test(path));
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const relativePath = normalizedRelative(file);
    if (text.includes('data-rw-dev-only')) continue;
    assert.doesNotMatch(text, /dangerouslySetInnerHTML|innerHTML\s*=|fetch\s*\(|XMLHttpRequest|https?:\/\//u, relativePath);
  }
});

test('browser history access is isolated to history mirror port', async () => {
  const files = (await walk(resolve(root, 'src'))).filter((path) => /\.(ts|tsx)$/u.test(path));
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const relativePath = normalizedRelative(file);
    if (!relativePath.endsWith('history-mirror.ts')) assert.doesNotMatch(text, /window\.history|popstate/u, relativePath);
  }
});

test('no numeric screen alias is hard-coded in TypeScript starter', async () => {
  const files = (await walk(resolve(root, 'src'))).filter(
    (path) => /\.(ts|tsx)$/u.test(path) && !normalizedRelative(path).includes('/generated/'),
  );
  for (const file of files) assert.doesNotMatch(await readFile(file, 'utf8'), /['"]S\d{2}['"]/u, normalizedRelative(file));
});
