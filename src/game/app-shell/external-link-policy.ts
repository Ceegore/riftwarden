/**
 * Phase 30 external link security policy (EXTERNAL_LINK_SECURITY_CONTRACT):
 * only HTTPS to known hosts; in release, placeholder-looking URLs are refused.
 * javascript:/data:/file:/http: are rejected at the scheme step. No WebView is
 * involved — this module decides whether a URL may leave through the system
 * browser at all.
 */
import { AppShellError } from './app-shell-error.js';

export interface LinkPolicy {
  readonly allowedHosts: readonly string[];
  readonly release: boolean;
}

const PLACEHOLDER_PATTERN = /example\.|\.invalid$|placeholder/i;

/** Returns the approved URL or throws with a closed refusal code. */
export function validateExternalUrl(raw: string, policy: LinkPolicy): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppShellError('LINK_SCHEME_REFUSED', { reason: 'unparseable' });
  }
  if (url.protocol !== 'https:') {
    throw new AppShellError('LINK_SCHEME_REFUSED', { protocol: url.protocol });
  }
  if (!policy.allowedHosts.includes(url.hostname)) {
    throw new AppShellError('LINK_HOST_REFUSED', { host: url.hostname });
  }
  if (policy.release && PLACEHOLDER_PATTERN.test(url.hostname + url.pathname)) {
    throw new AppShellError('LINK_PLACEHOLDER_REFUSED', { url: raw });
  }
  return url;
}
