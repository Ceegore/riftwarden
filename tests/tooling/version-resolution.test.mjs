import test from 'node:test';
import assert from 'node:assert/strict';
import { selectHighestStable } from '../../tools/toolchain/registry-client.mjs';

test('selects highest stable within fixed major and excludes prerelease/deprecated', () => {
  const metadata={versions:{
    '8.1.0':{license:'MIT'},
    '8.2.0-beta.1':{license:'MIT'},
    '8.2.0':{license:'MIT',deprecated:'bad'},
    '8.1.4':{license:'MIT'},
    '9.0.0':{license:'MIT'},
  }};
  assert.equal(selectHighestStable(metadata,8).version,'8.1.4');
});
