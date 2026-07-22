import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnvironment } from '../../tools/env/contracts.mjs';

const validRelease={
  VITE_BUILD_CHANNEL:'release',
  VITE_CONTENT_VERSION:'a'.repeat(64),
  VITE_ENABLE_DEVTOOLS:'false',
  VITE_SUPPORT_URL:'https://support.example.com/riftwarden',
  VITE_PRIVACY_URL:'https://privacy.example.com/riftwarden',
};
test('accepts closed release environment',()=>assert.equal(validateEnvironment(validRelease,'release').ok,true));
test('rejects unknown VITE key',()=>assert.equal(validateEnvironment({...validRelease,VITE_SECRET:'x'},'release').ok,false));
test('rejects fixed seed in release',()=>assert.equal(validateEnvironment({...validRelease,VITE_FIXED_TEST_SEED:'1'},'release').ok,false));
test('rejects placeholder URLs in release',()=>assert.equal(validateEnvironment({...validRelease,VITE_SUPPORT_URL:'https://example.invalid/x'},'release').ok,false));
