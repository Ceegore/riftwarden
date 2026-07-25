import type { ReactNode } from 'react';
import type { LocaleController } from './locale-state';
import { LocaleControllerContext } from './locale-hooks';

export function LocaleProvider(props:Readonly<{ controller:LocaleController; children:ReactNode }>) {
  return <LocaleControllerContext.Provider value={props.controller}>{props.children}</LocaleControllerContext.Provider>;
}
