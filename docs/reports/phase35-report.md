# Phase 35 — Archive, Codex, Achievements, Mastery, Records

**Status:** IMPLEMENTED (machine-verified). Gate G35: BLOCKED on operator evidence.

## Scope

Phase 35 delivers the knowledge layer: a codex of discovered entities, an
achievement system with definitions and a persistent store, hero mastery
tracking, mission records and statistics, a story archive, and the Archive
Hub screen that unifies navigation across all five subsystems.

## Delivered

| Artifact | Path |
|---|---|
| Codex store + types | `src/game/codex/` |
| Achievement store + defs | `src/game/achievements/` |
| Mastery store + types | `src/game/mastery/` |
| Records store | `src/game/records/` |
| Story store | `src/game/story/` |
| Archive hub | `src/screens/hq/ArchiveHubScreen.tsx` |
| Codex screens | `src/screens/hq/CodexListScreen.tsx`, `CodexDetailsScreen.tsx` |
| Achievements screen | `src/screens/hq/AchievementsScreen.tsx` |
| Mastery screen | `src/screens/hq/MasteryScreen.tsx` |
| Records screen | `src/screens/hq/RecordsStatisticsScreen.tsx` |
| Story archive | `src/screens/hq/StoryArchiveScreen.tsx` |
| Test suite | `tests/sim/phase35-domain.test.ts` |

## Gate Status

- G35 machine items: 2/2 SATISFIED
- G35 operator items: 3 BLOCKED (G34 chain, codex discovery device, achievement tracking review)
