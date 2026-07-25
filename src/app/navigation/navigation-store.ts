import type { AppRoute } from './route-types';

export interface NavigationState {
  readonly stack: readonly AppRoute[];
  readonly revision: number;
}

export type NavigationCommand =
  | { readonly type: 'push'; readonly route: AppRoute }
  | { readonly type: 'replace'; readonly route: AppRoute }
  | { readonly type: 'back' }
  | { readonly type: 'reset'; readonly route: AppRoute };

export function reduceNavigation(
  state: NavigationState,
  command: NavigationCommand,
): NavigationState {
  switch (command.type) {
    case 'push':
      return { stack: [...state.stack, command.route], revision: state.revision + 1 };
    case 'replace':
      return {
        stack: [...state.stack.slice(0, -1), command.route],
        revision: state.revision + 1,
      };
    case 'back':
      return state.stack.length > 1
        ? { stack: state.stack.slice(0, -1), revision: state.revision + 1 }
        : state;
    case 'reset':
      return { stack: [command.route], revision: state.revision + 1 };
  }
}

export function currentRoute(state: NavigationState): AppRoute {
  const route = state.stack.at(-1);
  if (!route) throw new Error('NAV_HISTORY_STATE_INVALID');
  return route;
}
