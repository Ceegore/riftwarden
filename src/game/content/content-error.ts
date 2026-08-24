export class ContentError extends Error {
  constructor(
    public readonly code: string,
    public readonly details: Readonly<Record<string, unknown>>,
  ) {
    super(`[${code}] ${JSON.stringify(details)}`);
    this.name = 'ContentError';
  }
}