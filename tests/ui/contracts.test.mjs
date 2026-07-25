import test from 'node:test'; import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises'; import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../../..'); const read=async(p)=>JSON.parse(await readFile(resolve(root,p),'utf8'));
test('all required button states exist',async()=>{const c=await read('contracts/component-state-matrix.json');for(const s of ['default','focus-visible','pressed','disabled','loading'])assert.ok(c.components.PrimaryButton.includes(s));});
test('all three locales exist',async()=>{const f=await read('starter-kit/src/screens/dev/gallery-fixtures.json');assert.deepEqual(f.locales,['de','en','qps-ploc']);});
test('full text scale range exists',async()=>{const f=await read('starter-kit/src/screens/dev/gallery-fixtures.json');assert.deepEqual(f.textScales,[1,1.15,1.3,1.5,1.75,2]);});
test('all color profiles exist',async()=>{const f=await read('starter-kit/src/screens/dev/gallery-fixtures.json');assert.equal(f.colorProfiles.length,4);});
test('release patterns include gallery and fixed seed',async()=>{const c=await read('contracts/release-exclusion-contract.json');assert.ok(c.forbiddenReleasePatterns.includes('ComponentGalleryScreen'));assert.ok(c.forbiddenReleasePatterns.includes('VITE_FIXED_TEST_SEED'));});
test('layout supports narrow fallback and large cap',async()=>{const l=await read('contracts/layout-classes.json');assert.ok(l.classes.some((x)=>x.id==='portrait_narrow'));assert.equal(l.classes.find((x)=>x.id==='large').contentMaxPx,1600);});
