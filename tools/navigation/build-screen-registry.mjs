import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseStrictJson } from './lib/strict-json.mjs';
import { validateAliasResolution,validateCatalog,registryGroups,renderGroupTs,renderIndexTs } from './lib/registry-core.mjs';

const root=resolve(process.argv[2]??'.');
const release=process.argv.includes('--release');
const sourcePath=resolve(root,'src/app/navigation/screen-registry.source.json');
const aliasPath=resolve(root,'src/app/navigation/screen-alias-resolution.source.json');
const catalog=validateCatalog(parseStrictJson(await readFile(sourcePath,'utf8'),sourcePath));
const aliases=validateAliasResolution(parseStrictJson(await readFile(aliasPath,'utf8'),aliasPath),{release});
const groups=registryGroups(catalog,aliases);
const outDir=resolve(root,'src/app/navigation/generated');
await mkdir(outDir,{recursive:true});
for (const [group,entries] of Object.entries(groups)) {
  await writeFile(resolve(outDir,`registry-${group}.ts`),renderGroupTs(group,entries));
}
await writeFile(resolve(outDir,'screen-registry.generated.ts'),renderIndexTs(groups));
console.log(JSON.stringify({ok:true,release,entries:catalog.entries.length,groups:Object.keys(groups).sort()},null,2));
