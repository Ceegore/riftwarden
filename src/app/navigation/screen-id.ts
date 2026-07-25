import { generatedScreenRegistrations } from './generated/screen-registry.generated';

export type ScreenRegistrationRecord = (typeof generatedScreenRegistrations)[number];
export type ScreenKey = ScreenRegistrationRecord['screenKey'];
export type OverlayKey = Extract<ScreenRegistrationRecord, { kind: 'overlay' }>['screenKey'];
export type RoutableScreenKey = Extract<ScreenRegistrationRecord, { kind: 'screen' }>['screenKey'];

export function isScreenKey(value: string): value is ScreenKey {
  return generatedScreenRegistrations.some((entry) => entry.screenKey === value);
}

export function isRoutableScreenKey(value: string): value is RoutableScreenKey {
  return generatedScreenRegistrations.some(
    (entry) => entry.kind === 'screen' && entry.screenKey === value,
  );
}
