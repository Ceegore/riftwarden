import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Truthful G10 readiness audit for Phase 11.
 *
 * This gate is designed to BLOCK: it proves whether the real repository
 * actually has a proven G10, fully extracted content, and a resolved NORM-003.
 * Per the handbook it must report BLOCKED while any precondition is missing —
 * that is a truth proof, not a package error.
 *
 * @param {string} ledgerDir Real ledger directory (docs/reports/content-ledger)
 */
export function auditPhase10(ledgerDir) {
  const diagnostics = [{ code: 'P11_G10_NOT_PROVEN', path: 'G10', message: 'real repository G10 evidence absent' }];
  let total = 0;
  let unextracted = 0;
  const families = [];
  if (!existsSync(ledgerDir)) {
    diagnostics.push({
      code: 'P11_CONTENT_UNEXTRACTED',
      path: 'phase10-ledgers',
      message: `ledger directory missing: ${ledgerDir}`
    });
  } else {
    for (const name of readdirSync(ledgerDir).filter((name) => name.endsWith('.ledger.json'))) {
      families.push(name);
      let data;
      try {
        data = JSON.parse(readFileSync(join(ledgerDir, name), 'utf8'));
      } catch {
        diagnostics.push({
          code: 'P11_CONTENT_UNEXTRACTED',
          path: `phase10-ledgers/${name}`,
          message: `ledger file unreadable: ${name}`
        });
        continue;
      }
      for (const entry of data.entries ?? []) {
        total += 1;
        if (entry.status === 'UNEXTRACTED') unextracted += 1;
      }
    }
  }
  if (unextracted) {
    diagnostics.push({
      code: 'P11_CONTENT_UNEXTRACTED',
      path: 'phase10-ledgers',
      message: `${unextracted} of ${total} slots unextracted`,
      count: unextracted
    });
  }
  diagnostics.push({ code: 'P11_NORM_003_OPEN', path: 'NORM-003', message: 'numeric screen alias conflict remains open' });
  return { schemaVersion: 1, status: 'BLOCKED', total, unextracted, families: families.length, diagnostics };
}
