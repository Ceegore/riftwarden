import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeepLink } from '../../tools/navigation/lib/deep-link-core.mjs';
import { loadContracts } from './test-helpers.mjs';

test('test-only approved custom-scheme destination parses',async()=>{
  const {deepLinks}=await loadContracts();
  assert.deepEqual(parseDeepLink('riftwarden://title',deepLinks,{testMode:true}),{destination:'title'});
});
test('release blocks unapproved allowlist',async()=>{
  const {deepLinks}=await loadContracts();
  assert.throws(()=>parseDeepLink('riftwarden://title',deepLinks),(e)=>e.code==='NAV_DEEP_LINK_ALLOWLIST_UNAPPROVED');
});
test('http and https schemes are forbidden',async()=>{
  const {deepLinks}=await loadContracts();
  for (const raw of ['https://title','http://title']) assert.throws(()=>parseDeepLink(raw,deepLinks,{testMode:true}),(e)=>e.code==='NAV_INVALID_DEEP_LINK');
});
test('query fragment traversal and nested paths are forbidden',async()=>{
  const {deepLinks}=await loadContracts();
  for (const raw of ['riftwarden://title?x=1','riftwarden://title#x','riftwarden://title/child','riftwarden://../title']) {
    assert.throws(()=>parseDeepLink(raw,deepLinks,{testMode:true}),(e)=>e.code==='NAV_INVALID_DEEP_LINK');
  }
});
test('unknown destination is rejected',async()=>{
  const {deepLinks}=await loadContracts();
  assert.throws(()=>parseDeepLink('riftwarden://merchant',deepLinks,{testMode:true}),(e)=>e.code==='NAV_INVALID_DEEP_LINK');
});
