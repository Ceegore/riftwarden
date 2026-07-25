import { resolve } from 'node:path';
import { loadTokenSource } from './lib/token-source-loader.mjs';
import { validateTokenSource } from './lib/token-core.mjs';

const args = new Set(process.argv.slice(2));
const mode = args.has('--release') ? 'release' : 'structure';
const root = resolve([...args].find((value) => !value.startsWith('--')) ?? '.');
const sourcePath = resolve(root, 'src/ui/tokens/tokens.source.json');

try {
  const result = validateTokenSource(await loadTokenSource(sourcePath), { mode });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
} catch (error) {
  console.log(JSON.stringify({ ok: false, mode, diagnostics: [{ code: error?.code ?? 'P07_TOKEN_JSON_INVALID', message: error instanceof Error ? error.message : String(error), sourcePath }] }, null, 2));
  process.exit(1);
}
