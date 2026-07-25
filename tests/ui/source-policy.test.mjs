import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else output.push(path);
  }
  return output;
}

test('UI source never renders locale or content HTML', async () => {
  const files = (await walk(resolve(root, 'src'))).filter((path) => /\.(ts|tsx)$/.test(path));
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML/, relative(root, file));
  }
});

test('UI starter contains no runtime network or remote font path', async () => {
  const files = await walk(root);
  for (const file of files.filter((path) => /\.(ts|tsx|css|json)$/.test(path))) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /https?:\/\/|@import\s+url|fetch\s*\(|new\s+WebSocket/, relative(root, file));
  }
});

test('authored CSS uses token variables instead of raw colors', async () => {
  const files = (await walk(resolve(root, 'src')))
    .filter((path) => path.endsWith('.css') && !path.includes('/generated/'));
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/, relative(root, file));
  }
});

test('release route uses a compile-time channel guard and dynamic import', async () => {
  const source = await readFile(resolve(root, 'src/screens/dev/dev-route.tsx'), 'utf8');
  assert.match(source, /VITE_BUILD_CHANNEL/);
  assert.match(source, /VITE_ENABLE_DEVTOOLS/);
  assert.match(source, /return import\('\.\/ComponentGalleryScreen'\)/);
});

test('modal reference includes Escape, Tab trap and focus restoration', async () => {
  const source = await readFile(resolve(root, 'src/ui/components/Modal.tsx'), 'utf8');
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /previous\.current/);
  assert.match(source, /target\.focus\(\)/);
});
