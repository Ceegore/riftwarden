/**
 * Screen module resolver (SCREEN_RESOLVER_CONTRACT): the single concrete
 * implementation of the ScreenModuleResolver interface. Maps every
 * registered loaderId to its React component. Each screen group contributes
 * its modules through a typed module map; the resolver flattens them.
 *
 * Screen groups add their modules here as they are built — the registry
 * (screen-registry.source.json + generated registrations) declares which
 * screens exist, and the resolver provides their implementations.
 */
import type { ScreenModule, ScreenModuleResolver } from '../app/navigation/screen-registration.js';
import { runScreenModules } from './run/screen-modules.js';

const MODULES: Readonly<Record<string, ScreenModule>> = {
  ...runScreenModules,
};

export const screenResolver: ScreenModuleResolver = {
  async load(loaderId: string): Promise<ScreenModule> {
    const module = MODULES[loaderId];
    if (module === undefined) {
      throw new Error(`SCREEN_RESOLVER_UNKNOWN_LOADER:${loaderId}`);
    }
    return module;
  },
};
