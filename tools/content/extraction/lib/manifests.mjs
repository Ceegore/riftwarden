import { createHash } from 'node:crypto';

/**
 * Deterministic requirement manifests derived from the reviewed ledger.
 *
 * The Phase 10 freeze contract covers "Locale-/Assetanforderungsmanifeste" and
 * a "Defect-/Decision-Snapshot". These are pure projections of the reviewed
 * ledger entries (plus the authority hash), so they are generated — never
 * hand-maintained — and byte-identical for identical ledger inputs.
 */

export function sha256Of(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

/**
 * @param {Array<{ family: string, data: any }>} ledgers
 * @param {object} opts
 * @returns {{ localizationManifest: object, assetManifest: object, defectSnapshot: object }}
 */
export function generateRequirementManifests(ledgers, { authoritySha256 = null } = {}) {
  const localization = {
    schemaVersion: 1,
    kind: 'content-localization-manifest',
    generated: 'from-reviewed-ledger',
    authoritySha256,
    locales: { de: 'AUTHORITY', en: 'DRAFT_OR_APPROVED' },
    keys: []
  };
  const assets = {
    schemaVersion: 1,
    kind: 'content-asset-manifest',
    generated: 'from-reviewed-ledger',
    authoritySha256,
    requirements: []
  };
  const defects = {
    schemaVersion: 1,
    kind: 'defect-snapshot',
    generated: 'from-reviewed-ledger',
    authoritySha256,
    openDefects: [],
    approvedDefects: [],
    decisions: []
  };

  for (const ledger of ledgers) {
    for (const entry of ledger.data.entries) {
      if (entry.status !== 'REVIEWED') continue;
      const pointer = entry.slotId;
      if (entry.localization?.deKey || entry.localization?.enKey) {
        localization.keys.push({
          slot: pointer,
          deKey: entry.localization?.deKey ?? null,
          enKey: entry.localization?.enKey ?? null,
          enStatus: entry.localization?.enStatus ?? 'NOT_STARTED'
        });
      }
      for (const asset of entry.assetRequirements ?? []) {
        assets.requirements.push({
          slot: pointer,
          id: asset?.id ?? null,
          kind: asset?.kind ?? null,
          status: asset?.status ?? null,
          ownerPhase: asset?.ownerPhase ?? null,
          path: asset?.path ?? null,
          sha256: asset?.sha256 ?? null
        });
      }
      for (const defectId of entry.review?.defectIds ?? []) {
        defects.openDefects.push({ slot: pointer, defectId });
      }
      if (entry.fidelity?.approvedDefectId) {
        defects.approvedDefects.push({ slot: pointer, defectId: entry.fidelity.approvedDefectId });
      }
    }
  }

  // Canonical ordering so identical inputs yield identical manifests.
  const cmp = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en');
  localization.keys.sort(cmp);
  assets.requirements.sort(cmp);
  defects.openDefects.sort(cmp);
  defects.approvedDefects.sort(cmp);
  defects.decisions.sort(cmp);

  return { localizationManifest: localization, assetManifest: assets, defectSnapshot: defects };
}

/**
 * Computes the sha256 digests of the generated manifests. The digests are what
 * the freeze baseline hashes, so the function is pure over the ledger input.
 */
export function manifestHashes(ledgers, { authoritySha256 = null } = {}) {
  const { localizationManifest, assetManifest, defectSnapshot } = generateRequirementManifests(ledgers, { authoritySha256 });
  return {
    localizationManifestSha256: sha256Of(localizationManifest),
    assetManifestSha256: sha256Of(assetManifest),
    defectSnapshotSha256: sha256Of(defectSnapshot)
  };
}
