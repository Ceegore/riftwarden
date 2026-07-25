import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readJson, reportAndExit } from './lib/io.mjs';

const root = process.cwd();
const contract = await readJson(
  path.join(root, 'reference/contracts/preliminary-system-copy-keys.json'),
);
const declaration = await readFile(
  path.join(root, 'src/locales/system-copy.ts'),
  'utf8',
);
const bundles = await readFile(
  path.join(root, 'src/locales/bootstrap-copy.ts'),
  'utf8',
);
const errors = [];

for (const key of contract.keys) {
  if (!declaration.includes(`'${key}'`)) {
    errors.push(`Missing declared copy key: ${key}`);
  }
  const bundleCount = bundles.split(`'${key}'`).length - 1;
  if (bundleCount !== 2) {
    errors.push(
      `Key ${key} must occur exactly in DE and EN source bundles; got ${bundleCount}.`,
    );
  }
}
if (!bundles.includes('const PSEUDO = Object.fromEntries')) {
  errors.push('Pseudo bundle must be generated deterministically.');
}
if (contract.requiredLocales.join(',') !== 'de,en,pseudo') {
  errors.push('Required preliminary locales must be de/en/pseudo.');
}

reportAndExit({
  tool: 'verify-copy-parity',
  ok: errors.length === 0,
  errors,
});
