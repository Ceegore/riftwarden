/**
 * Phase 40: A11yShell — applies accessibility CSS classes to the
 * document root so every component inherits text-scale, reduced-motion,
 * high-contrast, and color-blind-filter behaviour.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { loadA11ySettings } from '../../game/settings/a11y-settings.js';

function classListFromSettings(): string[] {
  const s = loadA11ySettings();
  const classes: string[] = [];
  classes.push(`rw-ts-${String(s.textScale)}`);
  if (s.reducedMotion) classes.push('rw-reduced-motion');
  if (s.highContrast) classes.push('rw-high-contrast');
  if (s.colorBlindFilter !== 'none') classes.push(`rw-cb-${s.colorBlindFilter}`);
  if (s.screenReaderMode) classes.push('rw-screen-reader');
  return classes;
}

export function A11yShell({ children }: { readonly children: ReactNode }) {
  const [classes, setClasses] = useState<string[]>(() => classListFromSettings());

  const refresh = useCallback(() => { setClasses(classListFromSettings()); }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key === 'rw.a11y.v1' || e.key === null) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('storage', onStorage); };
  }, [refresh]);

  useEffect(() => {
    const root = document.documentElement;
    for (const cls of classes) {
      root.classList.add(cls);
    }
    return () => {
      for (const cls of classes) {
        root.classList.remove(cls);
      }
    };
  }, [classes]);

  return <>{children}</>;
}