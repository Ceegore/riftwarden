// React type declarations are provided by @types/react. This file previously
// redeclared `module 'react'` with `unknown` member types, which shadowed the
// real declarations and made every React API resolve to `unknown` under
// type-checked linting (and under a clean tsc build). Those ambient module
// declarations are intentionally removed so the installed @types/react types
// are used instead. The JSX namespace is kept for ambient JSX consumers that
// still rely on it.

declare namespace JSX {
  type Element = unknown;
  type IntrinsicElements = Readonly<Record<string, Record<string, unknown>>>;
}
