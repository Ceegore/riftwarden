import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseStrictJson } from './lib/strict-json.mjs';
import { validateAliasResolution,validateCatalog } from './lib/registry-core.mjs';
import { parseDeepLink } from './lib/deep-link-core.mjs';

const root=resolve(process.argv[2]??'.');
const release=process.argv.includes('--release');
const load=async(rel)=>parseStrictJson(await readFile(resolve(root,rel),'utf8'),rel);
validateCatalog(await load('src/app/navigation/screen-registry.source.json'));
validateAliasResolution(await load('src/app/navigation/screen-alias-resolution.source.json'),{release});
const deep=await load('contracts/deep-link-allowlist.json');
if (release) parseDeepLink('riftwarden://title',deep);
console.log(JSON.stringify({ok:true,release},null,2));
