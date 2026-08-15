export type JsonScalar = null | boolean | string | number;
export type JsonValue = JsonScalar | readonly JsonValue[] | { readonly [key: string]: JsonValue };
