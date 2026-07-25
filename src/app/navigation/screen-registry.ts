import { generatedScreenRegistrations } from './generated/screen-registry.generated';
import type { ScreenModuleResolver, ScreenRegistration } from './screen-registration';
import type { ScreenKey } from './screen-id';

const registry = new Map<string, ScreenRegistration>(
  generatedScreenRegistrations.map((entry) => [entry.screenKey, entry]),
);

export function getScreenRegistration(screenKey: string): ScreenRegistration | undefined {
  return registry.get(screenKey);
}

export function requireScreenRegistration(screenKey: ScreenKey): ScreenRegistration {
  const registration = registry.get(screenKey);
  if (!registration) throw new Error(`NAV_UNKNOWN_SCREEN:${screenKey}`);
  return registration;
}

export async function loadScreenModule(
  screenKey: ScreenKey,
  resolver: ScreenModuleResolver,
): Promise<unknown> {
  const registration = requireScreenRegistration(screenKey);
  if (registration.kind !== 'screen') throw new Error(`NAV_UNKNOWN_SCREEN:${screenKey}`);
  return (await resolver.load(registration.loaderId)).default;
}

export function requireApprovedNumericAlias(screenKey: ScreenKey): string {
  const alias = requireScreenRegistration(screenKey).numericAlias;
  if (!alias) throw new Error(`NAV_NORM_003_UNRESOLVED:${screenKey}`);
  return alias;
}
