import { Browser } from '@capacitor/browser';

export type ExternalLinkId = 'support' | 'privacy' | 'licenses';

function requiredHttpsUrl(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not configured.`);
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error(`${name} must be a credential-free HTTPS URL.`);
  }
  return parsed.toString();
}

export function getExternalLinks(): Readonly<Record<ExternalLinkId, string>> {
  const env = import.meta.env;
  return {
    support: requiredHttpsUrl('VITE_SUPPORT_URL', String(env['VITE_SUPPORT_URL'] ?? '')),
    privacy: requiredHttpsUrl('VITE_PRIVACY_URL', String(env['VITE_PRIVACY_URL'] ?? '')),
    licenses: requiredHttpsUrl('VITE_LICENSES_URL', String(env['VITE_LICENSES_URL'] ?? '')),
  };
}

export async function openExternalLink(id: ExternalLinkId): Promise<void> {
  const url = getExternalLinks()[id];
  await Browser.open({ url, presentationStyle: 'popover' });
}
