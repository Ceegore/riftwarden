import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../../../tools/env/contracts.mjs';

describe('release environment', () => {
  it('rejects enabled developer tools', () => {
    const result = validateEnvironment({
      VITE_BUILD_CHANNEL: 'release',
      VITE_CONTENT_VERSION: 'a'.repeat(64),
      VITE_ENABLE_DEVTOOLS: 'true',
      VITE_SUPPORT_URL: 'https://support.example.com/riftwarden',
      VITE_PRIVACY_URL: 'https://privacy.example.com/riftwarden',
    }, 'release');
    expect(result.ok).toBe(false);
  });
});
