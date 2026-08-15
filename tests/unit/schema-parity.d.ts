// Ambient typings for the hand-kept .mjs mirror of the content/schemas .ts
// SSOT. Kept global (no imports/exports) so `declare module "*.mjs"` is a
// declaration, not an augmentation. See tests/unit/schema-parity.test.ts.
declare module "*.mjs" {
  export const ENTITY_SCHEMAS: Record<string, { safeParse(value: unknown): { success: boolean } }>;
}
