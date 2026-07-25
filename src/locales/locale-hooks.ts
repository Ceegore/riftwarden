import { createContext, useContext, useSyncExternalStore } from 'react';
import type { LocaleController, LocaleSnapshot } from './locale-state';

export const LocaleControllerContext = createContext<LocaleController | null>(null);

export function useLocaleController():LocaleController {
  const controller = useContext(LocaleControllerContext);
  if (!controller) throw new Error('LocaleProvider is missing');
  return controller;
}

export function useLocaleSnapshot():LocaleSnapshot {
  const controller = useLocaleController();
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
