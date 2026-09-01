import { createElement } from 'react';
import type { JSX } from 'react';
import type { AppRoute } from '../app/navigation/route-types.js';
import { getScreenRegistration } from '../app/navigation/screen-registry.js';
import { getScreenModule } from './screen-modules.js';

export type RegisteredScreenProps = Readonly<Record<string, unknown>>;
type RegisteredScreen = (props: RegisteredScreenProps) => JSX.Element;

function moduleForScreen(screenKey: string) {
  const registration = getScreenRegistration(screenKey);
  return registration === undefined ? undefined : getScreenModule(registration.loaderId);
}

export function hasRegisteredScreen(screenKey: string): boolean {
  return moduleForScreen(screenKey) !== undefined;
}

export function resolveRegisteredScreen(screenKey: string): RegisteredScreen | null {
  const module = moduleForScreen(screenKey);
  if (module === undefined) return null;
  return module.default as RegisteredScreen;
}

export function renderRegisteredScreen(
  screenKey: string,
  props: RegisteredScreenProps = {},
): JSX.Element {
  const component = resolveRegisteredScreen(screenKey);
  if (component === null) {
    throw new Error(`NAV_UNKNOWN_SCREEN:${screenKey}`);
  }
  return createElement(component, props);
}

/** Render a serialized AppRoute through the same registry used by live screens. */
export function renderRegisteredRoute(route: AppRoute): JSX.Element {
  return renderRegisteredScreen(route.screenKey, route.params);
}
