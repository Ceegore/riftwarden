/** Shared screen module table used by every navigation entry point. */
import type { ScreenModule } from '../app/navigation/screen-registration.js';
import { hqScreenModules } from './hq/hq-screen-modules.js';
import { runScreenModules } from './run/screen-modules.js';

export const screenModules: Readonly<Record<string, ScreenModule>> = {
  ...runScreenModules,
  ...hqScreenModules,
};

export function getScreenModule(loaderId: string): ScreenModule | undefined {
  return screenModules[loaderId];
}
