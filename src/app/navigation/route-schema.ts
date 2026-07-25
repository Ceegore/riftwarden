import { z } from 'zod';
import type { AppRoute } from './route-types';

export const routeParamSchema = z.union([
  z.string().min(1).max(160),
  z.number(),
  z.boolean(),
]);

export const appRouteSchema: z.ZodType<AppRoute> = z.lazy(() =>
  z
    .object({
      screenKey: z.string().min(1),
      params: z.record(z.string(), routeParamSchema),
      returnRoute: appRouteSchema.optional(),
      restoreToken: z.string().min(1).max(160).optional(),
    })
    .strict(),
) as z.ZodType<AppRoute>;

export function countReturnDepth(route: AppRoute): number {
  let depth = 0;
  let current: AppRoute | undefined = route.returnRoute;
  while (current) {
    depth += 1;
    current = current.returnRoute;
  }
  return depth;
}
