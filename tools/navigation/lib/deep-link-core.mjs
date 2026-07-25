import { fail } from './diagnostic.mjs';

export function parseDeepLink(raw,contract,{testMode=false}={}) {
  let url;
  try { url=new URL(raw); } catch { fail('NAV_INVALID_DEEP_LINK','Deep link is not a valid URL'); }
  if (url.protocol!==`${contract.scheme}:`) fail('NAV_INVALID_DEEP_LINK','Deep link scheme is forbidden');
  if (url.search || url.hash) fail('NAV_INVALID_DEEP_LINK','Query strings and fragments are forbidden');
  if (url.pathname && url.pathname !== '/') fail('NAV_INVALID_DEEP_LINK','Nested deep-link paths are forbidden');
  const destination=(url.hostname || url.pathname.replace(/^\/+/u,'')).trim();
  if (!destination || destination.includes('/') || destination.includes('..')) fail('NAV_INVALID_DEEP_LINK','Deep link path is invalid');
  const allowlist=contract.approved?contract.destinations:(testMode?contract.testOnlyFixtureDestinations:[]);
  if (!contract.approved && !testMode) fail('NAV_DEEP_LINK_ALLOWLIST_UNAPPROVED','Deep-link destination allowlist is not approved');
  if (!allowlist.includes(destination)) fail('NAV_INVALID_DEEP_LINK',`Deep-link destination is not allowlisted: ${destination}`);
  if (contract.externalContentLoading!==false) fail('NAV_EXTERNAL_CONTENT_FORBIDDEN','Deep links may not load external content');
  return {destination};
}
