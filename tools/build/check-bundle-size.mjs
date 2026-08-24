/**
 * check-bundle-size.mjs — builds the Vite production bundle and asserts
 * the total gzipped JS payload is ≤ 2.5 MiB (the Phase 41 hard limit).
 */
import { build } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const distDir = resolve(root, 'dist');

const HARD_JS_LIMIT_MIB = 2.5;
const HARD_JS_LIMIT = Math.floor(HARD_JS_LIMIT_MIB * 1024 * 1024);

async function main() {
  await build({ root, logLevel: 'warn' });

  let totalJs = 0;
  const assetsDir = resolve(distDir, 'assets');
  try {
    const files = readdirSync(assetsDir);
    for (const file of files) {
      if (file.endsWith('.js')) {
        const buf = readFileSync(resolve(assetsDir, file));
        const gz = gzipSync(buf, { level: 9 });
        totalJs += gz.length;
      }
    }
  } catch {
    // dist/assets may not exist if only index.html was generated.
  }

  if (totalJs === 0) {
    console.warn('WARN: No JS assets found in dist/assets — did the build produce any?');
    process.exit(0);
  }

  const totalMiB = (totalJs / (1024 * 1024)).toFixed(2);
  if (totalJs > HARD_JS_LIMIT) {
    console.error(`FAIL: JS bundle size ${totalMiB} MiB exceeds ${HARD_JS_LIMIT_MIB} MiB hard limit.`);
    process.exit(1);
  }
  console.log(`PASS: JS bundle size ${totalMiB} MiB ≤ ${HARD_JS_LIMIT_MIB} MiB limit.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});