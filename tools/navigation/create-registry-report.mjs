import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parseStrictJson } from './lib/strict-json.mjs';
import { validateCatalog } from './lib/registry-core.mjs';

const root=resolve(process.argv[2]??'.');
const sourcePath=resolve(root,'src/app/navigation/screen-registry.source.json');
const aliasPath=resolve(root,'src/app/navigation/screen-alias-resolution.source.json');
const sourceText=await readFile(sourcePath,'utf8');
const aliasText=await readFile(aliasPath,'utf8');
const catalog=validateCatalog(parseStrictJson(sourceText,sourcePath));
const aliases=parseStrictJson(aliasText,aliasPath);
const report={
  schemaVersion:1,
  status:'STRUCTURE_ONLY_NOT_G08_EVIDENCE',
  counts:{
    screens:catalog.entries.filter((e)=>e.kind==='screen').length,
    overlays:catalog.entries.filter((e)=>e.kind==='overlay').length,
    reserved:catalog.reservedAliases.length,
    blockedNumericAliases:catalog.entries.filter((e)=>!aliases.approvedResolution?.[e.screenKey]).length,
  },
  hashes:{
    registrySource:createHash('sha256').update(sourceText).digest('hex'),
    aliasSource:createHash('sha256').update(aliasText).digest('hex'),
  },
  unresolved:[aliases.status],
};
const out=resolve(process.argv[3]??resolve(root,'../qa/results/registry-structure-report.json'));
await writeFile(out,`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
