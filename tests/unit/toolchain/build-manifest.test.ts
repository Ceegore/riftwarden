import { describe, expect, it } from 'vitest';
import { BUILD_MANIFEST } from '../../../src/app/buildManifest';

describe('build manifest contract', () => {
  it('uses a recognized build channel', () => {
    expect(['dev', 'qa', 'release']).toContain(BUILD_MANIFEST.channel);
  });
});
