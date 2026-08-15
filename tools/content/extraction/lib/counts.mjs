import { diag } from './diagnostic.mjs';

/**
 * Validates that every family matches its contract count and that totals equal
 * the release-counts contract. Returns an array of diagnostics (empty = clean).
 */
export function validateCounts(index, ledgers, counts) {
  const diagnostics = [];
  const byFamily = new Map(ledgers.map((ledger) => [ledger.family, ledger]));
  let gateTotal = 0;
  let supplementaryTotal = 0;
  for (const fam of index.families) {
    const ledger = byFamily.get(fam.family);
    const gateExpected = counts.gateCritical[fam.family];
    const supplementaryExpected = counts.supplementaryAuthoritative[fam.family];
    const expected = gateExpected ?? supplementaryExpected;
    if (expected === undefined) {
      diagnostics.push(diag('P10_COUNT_MISMATCH', `Family ${fam.family} is not in the release-counts contract.`, fam.family));
      continue;
    }
    const actual = ledger?.data.entries.length ?? 0;
    if (actual !== expected) {
      diagnostics.push(diag('P10_COUNT_MISMATCH', `Family ${fam.family}: expected ${expected} entries, found ${actual}.`, fam.family));
    }
    if (gateExpected !== undefined) gateTotal += actual;
    else supplementaryTotal += actual;
  }
  for (const family of index.families.map((f) => f.family)) {
    if (counts.forbiddenBuckets.includes(family)) {
      diagnostics.push(diag('P10_FORBIDDEN_BUCKET', `Forbidden bucket family "${family}" must not exist.`, family));
    }
  }
  if (gateTotal !== counts.totals.gateCritical) {
    diagnostics.push(diag('P10_COUNT_MISMATCH', `Gate-critical total ${gateTotal} != ${counts.totals.gateCritical}.`));
  }
  if (supplementaryTotal !== counts.totals.supplementaryAuthoritative) {
    diagnostics.push(diag('P10_COUNT_MISMATCH', `Supplementary total ${supplementaryTotal} != ${counts.totals.supplementaryAuthoritative}.`));
  }
  return diagnostics;
}
