import test from 'node:test'; import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises'; import { resolve } from 'node:path'; import { parseTokenSource } from '../../tools/ui/lib/token-source-loader.mjs'; import { flattenTokens,generateCss,generateTs,validateTokenSource } from '../../tools/ui/lib/token-core.mjs';
const root=resolve(import.meta.dirname,'../..'); const source=parseTokenSource(await readFile(resolve(root,'src/ui/tokens/tokens.source.json'),'utf8'),'tokens');
test('token source has approved exact GDD colors',()=>{assert.equal(source.tokens.color.gold.value,'#F2C66D');assert.equal(source.tokens.color['bg-void'].value,'#0B0A16');});
test('z levels are exact',()=>assert.deepEqual(Object.values(source.tokens.z).map((v)=>v.value),[0,10,20,30,40,50,60,70]));
test('motion tokens are exact',()=>assert.deepEqual(['instant','fast','standard','emphasis'].map((k)=>source.tokens.motion[k].value),[80,140,220,360]));
test('flatten is deterministic',()=>assert.deepEqual(flattenTokens(source),flattenTokens(structuredClone(source))));
test('css generation is deterministic',()=>assert.equal(generateCss(source),generateCss(structuredClone(source))));
test('ts generation is deterministic',()=>assert.equal(generateTs(source),generateTs(structuredClone(source))));
test('structure mode permits explicit approval blockers',()=>assert.equal(validateTokenSource(source,{mode:'structure'}).ok,true));
test('release mode blocks explicit unresolved tokens',()=>{const result=validateTokenSource(source,{mode:'release'});assert.equal(result.ok,false);assert.ok(result.blocking.some((d)=>d.path==='shadow.control'));});
test('unknown category blocks',()=>{const bad=structuredClone(source);bad.tokens.magic={x:{value:1,kind:'x',source:'x',approvalStatus:'approved'}};assert.throws(()=>flattenTokens(bad),/Unknown token category/);});
test('invalid token name blocks',()=>{const bad=structuredClone(source);bad.tokens.color['Bad Name']={value:'#FFFFFF',kind:'color',source:'x',approvalStatus:'approved'};assert.throws(()=>flattenTokens(bad),/Invalid token name/);});
test('bad contrast blocks',()=>{const bad=structuredClone(source);bad.contrastPairs=[{id:'bad',foreground:'color.border',background:'color.panel',minimum:4.5}];const r=validateTokenSource(bad,{mode:'structure'});assert.equal(r.ok,false);assert.equal(r.blocking[0].code,'P07_CONTRAST_BELOW_MINIMUM');});

test('duplicate JSON token key maps to stable P07 diagnostic',()=>assert.throws(()=>parseTokenSource('{\"tokens\":{\"color\":{\"a\":1,\"a\":2}}}','duplicate'),(error)=>error.code==='P07_TOKEN_DUPLICATE_KEY'));
test('malformed JSON maps to stable P07 diagnostic',()=>assert.throws(()=>parseTokenSource('{','malformed'),(error)=>error.code==='P07_TOKEN_JSON_INVALID'));
test('wrong unit blocks structure validation',()=>{const bad=structuredClone(source);bad.tokens.radius.small.unit='ms';const result=validateTokenSource(bad,{mode:'structure'});assert.equal(result.ok,false);assert.ok(result.blocking.some((d)=>d.code==='P07_TOKEN_UNIT_INVALID'));});
test('lowercase color blocks structure validation',()=>{const bad=structuredClone(source);bad.tokens.color.gold.value='#f2c66d';const result=validateTokenSource(bad,{mode:'structure'});assert.equal(result.ok,false);assert.ok(result.blocking.some((d)=>d.code==='P07_TOKEN_VALUE_INVALID'));});
