export const allowedViteVariables: ReadonlySet<string>;
export type BuildChannel = 'dev' | 'qa' | 'release';
export interface ValidatedEnvironment {
  channel: BuildChannel;
  contentVersion: string;
  devtoolsEnabled: boolean;
  fixedTestSeed: string | null;
  supportUrl: string;
  privacyUrl: string;
}
export function validateEnvironment(raw: Record<string, string>, expectedChannel?: BuildChannel):
  | { ok: true; value: ValidatedEnvironment }
  | { ok: false; errors: string[] };
