export class KernelInvariantError extends Error {
  constructor(readonly code: string, readonly details: Readonly<Record<string, unknown>> = {}) {
    super(code);
    this.name = 'KernelInvariantError';
    Object.freeze(details);
  }
}
