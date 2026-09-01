export type MathInvariantDetails = Readonly<Record<string, unknown>>;
export class MathInvariantError extends Error {
  constructor(readonly code: string, readonly details: MathInvariantDetails = {}) {
    super(code);
    this.name = 'MathInvariantError';
  }
}
