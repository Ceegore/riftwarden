import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStrictJson } from '../../tools/navigation/lib/strict-json.mjs';

export const root = fileURLToPath(new URL('../..', import.meta.url));
export async function loadJson(relativePath) {
  const path=resolve(root,relativePath);
  return parseStrictJson(await readFile(path,'utf8'),path);
}
export async function loadContracts() {
  return {
    catalog: await loadJson('src/app/navigation/screen-registry.source.json'),
    aliases: await loadJson('src/app/navigation/screen-alias-resolution.source.json'),
    params: await loadJson('contracts/route-parameter-schemas.json'),
    deepLinks: await loadJson('contracts/deep-link-allowlist.json'),
  };
}
