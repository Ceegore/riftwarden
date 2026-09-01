# Phase 41 — Performance, Memory, GPU, Bundle & Auto-Quality

**Status:** IMPLEMENTED (code layer). Gate G41: BLOCKED on device measurements.

## Scope

Phase 41 delivers performance infrastructure: a rolling frame-time monitor
with auto-quality degradation (high→medium→low), GPU budget tracking
(draw calls, texture binds, shader switches), a memory profiler for
save size limits and texture memory estimation, and a leak detection
heuristic.

## Delivered

| Artifact | Path |
|---|---|
| Auto-quality selector | `src/game/performance/auto-quality.ts` |
| GPU budget manager | `src/game/performance/gpu-budget.ts` |
| Memory profiler | `src/game/performance/memory-profiler.ts` |
| Pinned constants | `contracts/phase41/phase41-constants.json` |
| Readiness contract | `contracts/phase41/phase41-readiness.expected.json` |

## Gate Status

- G41 machine items: 2/2 SATISFIED
- G41 operator items: 4 BLOCKED (G40 chain, device frame measurements,
  thermal throttle evidence, bundle analysis, memory leak detection)
