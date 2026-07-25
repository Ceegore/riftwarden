import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadTokenSource } from './lib/token-source-loader.mjs';
import { generateCss, generateTs, validateTokenSource } from './lib/token-core.mjs';

const root = resolve(process.argv[2] ?? '.');
const sourcePath = resolve(root, 'src/ui/tokens/tokens.source.json');
const outDir = resolve(root, 'src/ui/tokens/generated');

try {
  const source = await loadTokenSource(sourcePath);
  const result = validateTokenSource(source, { mode: 'structure' });
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, 'tokens.css'), generateCss(source), 'utf8');
  await writeFile(resolve(outDir, 'tokens.ts'), generateTs(source), 'utf8');
  console.log(JSON.stringify({ ok: true, tokenCount: result.tokenCount, diagnostics: result.diagnostics }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, diagnostics: [{ code: error?.code ?? 'P07_TOKEN_JSON_INVALID', message: error instanceof Error ? error.message : String(error), sourcePath }] }, null, 2));
  process.exit(1);
}
