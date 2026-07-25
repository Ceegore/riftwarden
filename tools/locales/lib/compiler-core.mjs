import { createHash } from 'node:crypto';
import path from 'node:path';
import { loadCatalogs, readJsonFile } from './catalog.mjs';
import { parseMessage } from './message-parser.mjs';
import { compileRichText } from './rich-text.mjs';
import { analyzeAst } from './message-analysis.mjs';
import { canonicalJson } from './canonical-json.mjs';
import { validateProject } from './validator-core.mjs';
import { LocaleDiagnostic } from './diagnostic.mjs';

export async function compileProject(root, mode = 'development') {
  const validation = await validateProject(root, mode);
  if (validation.status !== 'PASS') throw new LocaleDiagnostic('L10N_COMPILE_BLOCKED', `Validation failed with ${validation.errorCount} errors`);
  const { index, catalogs } = await loadCatalogs(root);
  const tokenRegistry = await readJsonFile(path.join(root, 'config/rich-text-token-registry.json'));
  const bundles = new Map();
  for (const locale of index.releaseLocales) {
    const messages = {};
    for (const key of Object.keys(catalogs.get(locale)).sort()) {
      const item = catalogs.get(locale)[key];
      const ast = compileRichText(parseMessage(item.message, { sourcePath:item.sourcePath, key }), tokenRegistry, { sourcePath:item.sourcePath, key });
      messages[key] = {
        ast,
        parameters:analyzeAst(ast).parameters,
        budget:item.budget,
        compactKey:item.compactKey
      };
    }
    const payload = { schemaVersion:1, locale, kind:'release_locale_bundle', messages };
    const body = canonicalJson(payload);
    const sha256 = createHash('sha256').update(body).digest('hex');
    bundles.set(locale, { body, sha256, byteLength:Buffer.byteLength(body) });
  }
  return bundles;
}
