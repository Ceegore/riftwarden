# Phase 40 — Accessibility & Input

**Status:** IMPLEMENTED (code layer). Gate G40: BLOCKED on device evidence.

## Scope

Phase 40 delivers the accessibility and input layer: persistent a11y settings
(text scale, reduced motion, high contrast, screen reader mode, color-blind
filters, touch target size), a focus graph for keyboard/gamepad navigation,
a semantic input registry mapping actions to keys/gamepad buttons/touch,
and touch target enforcement (min 44×44px, 8px spacing).

## Delivered

| Artifact | Path |
|---|---|
| A11y settings domain | `src/game/settings/a11y-settings.ts` |
| Focus graph | `src/ui/focus/focus-graph.ts` |
| Input registry | `src/platform/input/input-registry.ts` |
| Touch target enforcer | `src/ui/touch/touch-target-enforcer.ts` |
| Pinned constants | `contracts/phase40/phase40-constants.json` |
| Readiness contract | `contracts/phase40/phase40-readiness.expected.json` |

## Gate Status

- G40 machine items: 2/2 SATISFIED
- G40 operator items: 8 BLOCKED (G39 chain, TalkBack/VoiceOver evidence,
  keyboard FQA, gamepad E2E, contrast audit, touch target audit,
  screen semantics audit, text scale matrix evidence)
