export type LocaleId = 'de' | 'en' | 'qps-ploc';
export type ReleaseLocale = 'de' | 'en';
export type BuildChannel = 'development' | 'test' | 'release';
export type PrimitiveParameter = string | number | boolean;
export type ParameterKind = 'string' | 'number' | 'select' | 'plural';

export type CompiledNode =
  | Readonly<{ t:'text'; v:string }>
  | Readonly<{ t:'arg'; n:string }>
  | Readonly<{ t:'number'; n:string }>
  | Readonly<{ t:'pound' }>
  | Readonly<{ t:'select'; n:string; b:Readonly<Record<string, readonly CompiledNode[]>> }>
  | Readonly<{ t:'plural'; n:string; b:Readonly<Record<string, readonly CompiledNode[]>> }>
  | Readonly<{ t:'token'; k:string; id:string; mode:'self'; c?:never }>
  | Readonly<{ t:'token'; k:string; id:string; mode:'paired'; c:readonly CompiledNode[] }>;

export interface CompiledMessage {
  readonly ast: readonly CompiledNode[];
  readonly parameters: Readonly<Record<string, ParameterKind>>;
  readonly budget: string;
  readonly compactKey: string | null;
}

export interface CompiledBundle {
  readonly schemaVersion: 1;
  readonly locale: LocaleId;
  readonly kind: 'release_locale_bundle' | 'generated_test_only_locale_bundle';
  readonly sourceLocale?: 'de';
  readonly messages: Readonly<Record<string, CompiledMessage>>;
}

export type MessageParameters = Readonly<Record<string, PrimitiveParameter>>;

export type FormattedPart =
  | Readonly<{ type:'text'; value:string }>
  | Readonly<{ type:'token'; kind:string; id:string; mode:'self' }>
  | Readonly<{ type:'token'; kind:string; id:string; mode:'paired'; children:readonly FormattedPart[] }>;
