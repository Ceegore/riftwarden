/**
 * Stable P10 diagnostic shape. `code` must be a registered defect code
 * (contracts/defect-codes.json); `pointer` locates the offending slot.
 */
export function diag(code, message, pointer = null) {
  return { code, message, ...(pointer ? { pointer } : {}) };
}
