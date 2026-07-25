export type ScreenKind = 'screen' | 'overlay';
export type RegistryGroup = 'system' | 'hq' | 'run' | 'settings' | 'overlays';

export interface ScreenRegistration {
  readonly screenKey: string;
  readonly section7Alias: string;
  readonly numericAlias: string | null;
  readonly aliasStatus: 'approved' | 'blocked';
  readonly label: string;
  readonly kind: ScreenKind;
  readonly group: RegistryGroup;
  readonly ownerPhase: string;
  readonly testId: string;
  readonly paramSchemaId: string;
  readonly backPolicyId: string;
  readonly requiredCapabilities: readonly string[];
  readonly screenshotProfileId: string;
  readonly loaderId: string;
}

export interface ScreenModule {
  readonly default: unknown;
}

export interface ScreenModuleResolver {
  load(loaderId: string): Promise<ScreenModule>;
}
