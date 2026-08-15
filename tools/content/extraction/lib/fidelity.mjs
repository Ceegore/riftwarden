import { diag } from './diagnostic.mjs';

/**
 * Validates an extraction-fidelity record. The record mirrors the starter-kit
 * fixture shape:
 *   { sourceNumericFacts, extractedNumericFacts, secondsConversion,
 *     sourceTextSha256, extractedTextSha256, approvedDefectId }
 *
 * @returns {Array<{ code: string, message: string, pointer?: string }>}
 */
export function validateFidelity(record) {
  const diagnostics = [];
  const src = record?.sourceNumericFacts;
  const ext = record?.extractedNumericFacts;
  if (!Array.isArray(src) || !Array.isArray(ext) || src.length !== ext.length || src.some((x, i) => x !== ext[i])) {
    diagnostics.push(diag('P10_FIDELITY_NUMERIC', 'Numeric facts must mirror the source exactly and in order.'));
  }
  if (record?.secondsConversion !== 'CENTRAL_COMPILER_ONLY') {
    diagnostics.push(diag('P10_MANUAL_TICK_CONVERSION', 'Seconds must stay authoring seconds; tick conversion is compiler-only.'));
  }
  if (record?.sourceTextSha256 && record?.extractedTextSha256 && record.sourceTextSha256 !== record.extractedTextSha256 && !record.approvedDefectId) {
    diagnostics.push(diag('P10_FIDELITY_TEXT', 'Extracted text deviates from source without an approved defect.'));
  }
  // §13 fidelity: a concrete rule that overrides a global rule must be
  // documented with an approved defect/decision, never silently tuned.
  if (record?.concreteRuleOverride && !record.approvedDefectId) {
    diagnostics.push(diag('P10_FIDELITY_TEXT', 'Concrete rule overrides a global rule without a documented approved defect/decision.'));
  }
  return diagnostics;
}
