import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyLicense } from '../../tools/toolchain/license-lib.mjs';
const policy={autoAllow:['MIT'],manualReview:['MPL-2.0'],deny:['GPL-3.0-only','UNLICENSED']};
test('allows MIT',()=>assert.equal(classifyLicense('MIT',policy),'allow'));
test('requires review for MPL',()=>assert.equal(classifyLicense('MPL-2.0',policy),'manual-review'));
test('blocks GPL and unknown',()=>{
  assert.equal(classifyLicense('GPL-3.0-only',policy),'block');
  assert.equal(classifyLicense(null,policy),'block');
});
