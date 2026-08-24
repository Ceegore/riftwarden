# Phase 38 — Asset, Animation, Atlas & VFX Production Pipeline

**Status:** CODE-STUB (type system + validators only). Gate G38: BLOCKED on production assets.

## Scope

Phase 38 defines the asset production pipeline: immutable asset IDs, a source
registry with provenance and licensing, a canonical asset manifest, a transform
graph for processing steps, deterministic export profiles, and validators for
atlas dimensions, animation clips, and telegraphy coverage.

## Delivered (code)

| Artifact | Path |
|---|---|
| Asset types | `src/game/content/assets/asset-manifest-types.ts` |
| Asset ID validator | `src/game/content/assets/asset-id-validator.ts` |
| Atlas validator | `src/game/content/atlas/atlas-validator.ts` |
| Content error | `src/game/content/content-error.ts` |
| Pinned constants | `contracts/phase38/phase38-constants.json` |
| Readiness contract | `contracts/phase38/phase38-readiness.expected.json` |

## Requires operator evidence

All 8 gate blockers are operator-side: this phase requires actual production
art assets, a populated source registry, a sprite atlas, animation clips,
VFX particle sheets, a license report, and device texture atlas testing.
None of these can be produced by code alone.