import type { ScreenModule, ScreenModuleResolver } from '../app/navigation/screen-registration.js';
import { getScreenModule } from './screen-modules.js';

export const screenResolver: ScreenModuleResolver = {
  load(loaderId: string): Promise<ScreenModule> {
    const module = getScreenModule(loaderId);
    if (module === undefined) {
      return Promise.reject(new Error(`SCREEN_RESOLVER_UNKNOWN_LOADER:${loaderId}`));
    }
    return Promise.resolve(module);
  },
};
