/**
 * Phase 30 idempotent action ledger: action tokens guard user-initiated flows
 * (continue, first-run completion, settings apply) so repeated confirm events
 * never fire a second transaction. The first run for an id executes exactly
 * once; repeats return undefined without invoking the action.
 */
export class ActionLedger {
  private readonly done = new Set<string>();

  run<T>(id: string, action: () => T): T | undefined {
    if (this.done.has(id)) return undefined;
    const result = action();
    this.done.add(id);
    return result;
  }

  has(id: string): boolean {
    return this.done.has(id);
  }

  /** Removes an id so the flow can be retried after a confirmed failure. */
  clear(id: string): void {
    this.done.delete(id);
  }
}
