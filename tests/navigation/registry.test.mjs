import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAliasResolution,validateCatalog,registryGroups } from '../../tools/navigation/lib/registry-core.mjs';
import { NavigationDiagnostic } from '../../tools/navigation/lib/diagnostic.mjs';
import { loadContracts } from './test-helpers.mjs';

test('catalog covers 61 screens and 7 overlays',async()=>{
  const {catalog}=await loadContracts();
  validateCatalog(catalog);
  assert.equal(catalog.entries.filter((e)=>e.kind==='screen').length,61);
  assert.equal(catalog.entries.filter((e)=>e.kind==='overlay').length,7);
});
test('reserved screen aliases are explicit and not routable',async()=>{
  const {catalog}=await loadContracts();
  assert.deepEqual(catalog.reservedAliases,['S37','S38','S39','S58','S59']);
  for (const alias of catalog.reservedAliases) assert.equal(catalog.entries.some((e)=>e.section7Alias===alias),false);
});
test('every screen key and section7 alias is unique',async()=>{
  const {catalog}=await loadContracts();
  validateCatalog(catalog);
  assert.equal(new Set(catalog.entries.map((e)=>e.screenKey)).size,catalog.entries.length);
  assert.equal(new Set(catalog.entries.map((e)=>e.section7Alias)).size,catalog.entries.length);
});
test('every registry row has loader, params, back, owner and test metadata',async()=>{
  const {catalog}=await loadContracts();
  for (const e of catalog.entries) {
    for (const key of ['loaderId','paramSchemaId','backPolicyId','ownerPhase','testId']) assert.ok(e[key]);
  }
});
test('structural alias validation accepts visible unresolved conflict',async()=>{
  const {aliases}=await loadContracts();
  assert.equal(validateAliasResolution(aliases,{release:false}).status,'UNRESOLVED_REQUIRES_APPROVED_G00_NORMALIZATION');
});
test('release alias validation blocks NORM-003',async()=>{
  const {aliases}=await loadContracts();
  assert.throws(()=>validateAliasResolution(aliases,{release:true}),(e)=>e instanceof NavigationDiagnostic&&e.code==='NAV_NORM_003_UNRESOLVED');
});
test('duplicate semantic keys block',async()=>{
  const {catalog}=await loadContracts(); const clone=structuredClone(catalog); clone.entries[1].screenKey=clone.entries[0].screenKey;
  assert.throws(()=>validateCatalog(clone),(e)=>e.code==='NAV_DUPLICATE_SCREEN_KEY');
});
test('duplicate numeric aliases block',async()=>{
  const {catalog}=await loadContracts(); const clone=structuredClone(catalog); clone.entries[1].section7Alias=clone.entries[0].section7Alias;
  assert.throws(()=>validateCatalog(clone),(e)=>e.code==='NAV_DUPLICATE_NUMERIC_ALIAS');
});
test('reserved alias made routable blocks',async()=>{
  const {catalog}=await loadContracts(); const clone=structuredClone(catalog); clone.entries[0].section7Alias='S37';
  assert.throws(()=>validateCatalog(clone),(e)=>['NAV_RESERVED_ALIAS_ROUTABLE','NAV_SOURCE_SCHEMA'].includes(e.code));
});
test('registry generation groups deterministically',async()=>{
  const {catalog,aliases}=await loadContracts(); const groups=registryGroups(catalog,aliases);
  assert.deepEqual(Object.keys(groups).sort(),['hq','overlays','run','settings','system']);
  for (const entries of Object.values(groups)) assert.deepEqual(entries.map((e)=>e.screenKey),[...entries].map((e)=>e.screenKey).sort());
});
