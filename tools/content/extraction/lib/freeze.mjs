import { createHash } from 'node:crypto';
import { canonicalJson } from '../../../lib/fs-utils.mjs';

const HEX64 = /^[0-9a-f]{64}$/;

/**
 * Throws P10_BASELINE_NOT_FREEZABLE when any required hash input is missing.
 */
export function assertBaselineInputs(value) {
  for (const [key, current] of Object.entries(value ?? {})) {
    if (!current || (key !== 'contentVersion' && !HEX64.test(current))) {
      throw new Error(`P10_BASELINE_NOT_FREEZABLE:${key}`);
    }
  }
}

/**
 * Creates the deterministic baseline over the canonicalized inputs.
 */
export function createBaseline(inputs) {
  assertBaselineInputs(inputs);
  const canonical = canonicalJson(inputs);
  const baselineSha256 = createHash('sha256').update(canonical).digest('hex');
  return { baselineSha256, inputs: { ...inputs }, canonical };
}
