import { diag } from './diagnostic.mjs';

export const LEDGER_STATUSES = ['UNEXTRACTED', 'EXTRACTED', 'IN_REVIEW', 'REVIEWED', 'BLOCKED'];
export const REVIEW_VERDICTS = ['PENDING', 'APPROVED', 'CHANGES_REQUIRED', 'BLOCKED'];
export const EN_STATUSES = ['NOT_STARTED', 'DRAFT', 'APPROVED'];
export const ASSET_KINDS = ['visual', 'audio', 'voice', 'telegraph', 'codex', 'icon', 'animation'];
export const ASSET_STATUSES = ['PLANNED', 'REQUIRED_PRESENT', 'PRESENT_VERIFIED'];

const ALLOWED = {
  UNEXTRACTED: ['EXTRACTED', 'BLOCKED'],
  EXTRACTED: ['IN_REVIEW', 'BLOCKED'],
  IN_REVIEW: ['REVIEWED', 'EXTRACTED', 'BLOCKED'],
  REVIEWED: ['EXTRACTED', 'BLOCKED'],
  BLOCKED: ['UNEXTRACTED', 'EXTRACTED']
};

export function canTransition(from, to) {
  return Boolean(ALLOWED[from]?.includes(to));
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) throw new Error(`P10_STATUS_TRANSITION:${from}->${to}`);
}

export function transitionDiagnostics(entries) {
  // The ledger stores only the current status; transitions are checked against
  // recorded (extractorAt/reviewedAt) evidence when a review record exists.
  const diagnostics = [];
  for (const entry of entries) {
    if (entry.review?.reviewedAt && entry.status === 'REVIEWED' && entry.review.verdict !== 'APPROVED') {
      diagnostics.push(diag('P10_STATUS_TRANSITION', `Slot ${entry.slotId} is REVIEWED without APPROVED verdict.`, entry.slotId));
    }
  }
  return diagnostics;
}
