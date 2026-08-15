import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { diag } from './diagnostic.mjs';
import { ASSET_KINDS, ASSET_STATUSES, EN_STATUSES, LEDGER_STATUSES, REVIEW_VERDICTS } from './status-machine.mjs';

const HEX64 = /^[0-9a-f]{64}$/;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assertSourceLocator(locator, pointer, diagnostics) {
  if (!locator || !locator.file?.endsWith('GDD_V5_PHASE10_AUTHORITY_EXTRACT.md')) {
    diagnostics.push(diag('P10_SOURCE_LOCATOR', 'Source locator file must be the Phase-10 GDD authority extract.', pointer));
    return;
  }
  if (!locator.chapter || !Number.isInteger(locator.lineStart) || !Number.isInteger(locator.lineEnd)) {
    diagnostics.push(diag('P10_SOURCE_LOCATOR', 'Source locator requires chapter and integer line range.', pointer));
    return;
  }
  if (locator.lineStart < 1 || locator.lineEnd < locator.lineStart || !HEX64.test(locator.lineSha256)) {
    diagnostics.push(diag('P10_SOURCE_LOCATOR', 'Source locator line range or line hash is invalid.', pointer));
  }
}

function assertAssetRequirements(items, pointer, diagnostics) {
  if (!Array.isArray(items)) {
    diagnostics.push(diag('P10_LEDGER_SHAPE', 'assetRequirements must be an array.', pointer));
    return;
  }
  for (const asset of items) {
    const at = `${pointer}#asset:${asset?.id ?? '?'}`;
    if (!asset?.id || !ASSET_KINDS.includes(asset.kind) || !ASSET_STATUSES.includes(asset.status)) {
      diagnostics.push(diag('P10_LEDGER_SHAPE', 'Asset requirement needs id, kind and valid status.', at));
    }
    if (!Number.isInteger(asset?.ownerPhase) || asset.ownerPhase < 1) {
      diagnostics.push(diag('P10_ASSET_OWNER', 'Asset requirement needs a positive owner phase.', at));
    }
    if (asset.status === 'REQUIRED_PRESENT' && (!asset.path || !asset.sha256)) {
      diagnostics.push(diag('P10_REQUIRED_ASSET_MISSING', 'REQUIRED_PRESENT asset needs path and hash.', at));
    }
    if (asset.path !== null && typeof asset.path !== 'string') {
      diagnostics.push(diag('P10_LEDGER_SHAPE', 'Asset path must be a string or null.', at));
    }
  }
}

/**
 * Validates ledger structure, source-locator integrity (line hashes against the
 * real authority file), runtime-ID policy and review-policy invariants.
 *
 * @param {Array<{ family: string, data: any }>} ledgers
 * @param {string} authorityPath Path to GDD_V5_PHASE10_AUTHORITY_EXTRACT.md
 * @returns {Array<{ code: string, message: string, pointer?: string }>}
 */
export async function validateLedgerShape(ledgers, authorityPath) {
  const diagnostics = [];
  const authority = await readFile(authorityPath, 'utf8');
  const lines = authority.split('\n');
  const seenSlotIds = new Set();
  const seenRuntimeIds = new Map();
  for (const ledger of ledgers) {
    const data = ledger.data;
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.entries)) {
      diagnostics.push(diag('P10_LEDGER_SHAPE', `Ledger ${ledger.family} must have schemaVersion 1 and an entries array.`, ledger.family));
      continue;
    }
    if (data.family !== ledger.family) {
      diagnostics.push(diag('P10_LEDGER_SHAPE', `Ledger family "${data.family}" does not match index family "${ledger.family}".`, ledger.family));
    }
    for (const entry of data.entries) {
      const pointer = entry?.slotId ?? `${ledger.family}:?`;
      if (!entry?.slotId || !entry.slotId.startsWith(`${ledger.family}:`) || !/^\d{3}$/.test(entry.slotId.split(':')[1] ?? '')) {
        diagnostics.push(diag('P10_LEDGER_SHAPE', `slotId must match ${ledger.family}:NNN.`, pointer));
      } else if (seenSlotIds.has(entry.slotId)) {
        diagnostics.push(diag('P10_LEDGER_SHAPE', `Duplicate slotId ${entry.slotId}.`, pointer));
      } else {
        seenSlotIds.add(entry.slotId);
      }
      if (!entry.authorityLabel || /unknown|misc/i.test(entry.authorityLabel)) {
        diagnostics.push(diag('P10_LEDGER_SHAPE', 'Slot needs a concrete authority label.', pointer));
      }
      if (!LEDGER_STATUSES.includes(entry.status)) {
        diagnostics.push(diag('P10_LEDGER_SHAPE', `Invalid ledger status ${entry.status}.`, pointer));
      }
      if (entry.status === 'UNEXTRACTED' && entry.runtimeId !== null) {
        diagnostics.push(diag('P10_RUNTIME_ID', 'Unextracted slot must not carry an invented runtime ID.', pointer));
      }
      if (entry.runtimeId !== null) {
        if (seenRuntimeIds.has(entry.runtimeId)) {
          diagnostics.push(diag('P10_RUNTIME_ID_DUPLICATE', `Duplicate runtime ID ${entry.runtimeId}.`, pointer));
        } else {
          seenRuntimeIds.set(entry.runtimeId, pointer);
        }
      }
      assertSourceLocator(entry.sourceLocator, pointer, diagnostics);
      const locator = entry.sourceLocator;
      if (locator && lines.length >= locator.lineEnd) {
        const slice = lines.slice(locator.lineStart - 1, locator.lineEnd).join('\n');
        if (sha256(slice) !== locator.lineSha256) {
          diagnostics.push(diag('P10_SOURCE_HASH', `Source line hash mismatch for ${locator.file}:${locator.lineStart}.`, pointer));
        }
      } else if (locator && Number.isInteger(locator.lineStart)) {
        diagnostics.push(diag('P10_SOURCE_HASH', `Source line ${locator.lineStart} is outside the authority file.`, pointer));
      }
      if (!entry.review || !REVIEW_VERDICTS.includes(entry.review.verdict)) {
        diagnostics.push(diag('P10_LEDGER_SHAPE', 'Slot needs a review record with a valid verdict.', pointer));
      }
      if (entry.review?.verdict === 'APPROVED' && (entry.review.defectIds?.length ?? 0) > 0) {
        diagnostics.push(diag('P10_OPEN_DEFECT', 'APPROVED review must not carry open defects.', pointer));
      }
      if (!entry.fidelity || entry.fidelity.secondsConversion !== 'CENTRAL_COMPILER_ONLY') {
        diagnostics.push(diag('P10_MANUAL_TICK_CONVERSION', 'Fidelity secondsConversion must be CENTRAL_COMPILER_ONLY.', pointer));
      }
      if (!entry.localization || !EN_STATUSES.includes(entry.localization.enStatus)) {
        diagnostics.push(diag('P10_LEDGER_SHAPE', 'Slot needs a localization record with a valid enStatus.', pointer));
      }
      if (entry.status === 'REVIEWED') {
        if (!entry.extractor || !entry.review?.reviewer) {
          diagnostics.push(diag('P10_REVIEW_MISSING', 'REVIEWED slot needs extractor and reviewer.', pointer));
        } else if (entry.extractor === entry.review.reviewer) {
          diagnostics.push(diag('P10_REVIEW_NOT_INDEPENDENT', 'Extractor and reviewer must be different identities.', pointer));
        }
        if (entry.review?.verdict !== 'APPROVED') {
          diagnostics.push(diag('P10_REVIEW_MISSING', 'REVIEWED slot needs an APPROVED verdict.', pointer));
        }
        if (!entry.localization?.deKey || !entry.localization?.enKey) {
          diagnostics.push(diag('P10_LOCALIZATION_KEY', 'REVIEWED slot needs DE and EN localization keys.', pointer));
        }
        if (entry.localization?.enStatus === 'NOT_STARTED') {
          diagnostics.push(diag('P10_EN_STATUS', 'REVIEWED slot needs EN copy at DRAFT or APPROVED.', pointer));
        }
      }
      assertAssetRequirements(entry.assetRequirements, pointer, diagnostics);
    }
  }
  return diagnostics;
}
