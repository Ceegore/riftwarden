export const allowedViteVariables = new Set([
  'VITE_BUILD_CHANNEL',
  'VITE_CONTENT_VERSION',
  'VITE_ENABLE_DEVTOOLS',
  'VITE_FIXED_TEST_SEED',
  'VITE_SUPPORT_URL',
  'VITE_PRIVACY_URL',
]);

const channels = new Set(['dev','qa','release']);
const hashPattern = /^[a-f0-9]{64}$/;

function parseBoolean(name, value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be exactly true or false.`);
}

function isPlaceholderUrl(value) {
  return value.includes('example.invalid') || value.includes('[PUBLISHER]') || value.trim() === '';
}

export function validateEnvironment(raw, expectedChannel) {
  const errors=[];
  for (const key of Object.keys(raw)) {
    if (key.startsWith('VITE_') && !allowedViteVariables.has(key)) errors.push(`Unknown client variable: ${key}`);
  }
  const channel=raw.VITE_BUILD_CHANNEL;
  if (!channels.has(channel)) errors.push('VITE_BUILD_CHANNEL must be dev, qa or release.');
  if (expectedChannel && channel !== expectedChannel) errors.push(`Expected channel ${expectedChannel}, received ${String(channel)}.`);
  let devtools=null;
  try { devtools=parseBoolean('VITE_ENABLE_DEVTOOLS',raw.VITE_ENABLE_DEVTOOLS ?? ''); } catch (error) { errors.push(error.message); }
  if (channel === 'release') {
    if (devtools !== false) errors.push('Release requires VITE_ENABLE_DEVTOOLS=false.');
    if ('VITE_FIXED_TEST_SEED' in raw && raw.VITE_FIXED_TEST_SEED !== '') errors.push('Release forbids VITE_FIXED_TEST_SEED.');
    if (!hashPattern.test(raw.VITE_CONTENT_VERSION ?? '')) errors.push('Release VITE_CONTENT_VERSION must be a lowercase SHA-256.');
    for (const key of ['VITE_SUPPORT_URL','VITE_PRIVACY_URL']) {
      const value=raw[key] ?? '';
      try {
        const url=new URL(value);
        if (url.protocol !== 'https:' || isPlaceholderUrl(value)) errors.push(`${key} must be a non-placeholder HTTPS URL.`);
      } catch { errors.push(`${key} must be a valid HTTPS URL.`); }
    }
  }
  if (errors.length > 0) return {ok:false,errors};
  return {ok:true,value:{
    channel,
    contentVersion:raw.VITE_CONTENT_VERSION ?? '',
    devtoolsEnabled:devtools,
    fixedTestSeed:raw.VITE_FIXED_TEST_SEED || null,
    supportUrl:raw.VITE_SUPPORT_URL ?? '',
    privacyUrl:raw.VITE_PRIVACY_URL ?? '',
  }};
}
