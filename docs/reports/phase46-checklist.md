# Phase 46 — Adversarial Full Regression

**Status:** DOCUMENTATION-ONLY. Gate G46: BLOCKED on real device testing.

## Required Operator Evidence

1. **Real G45 gate proven.** This document cannot self-certify.
2. **Exactly one frozen, uniquely hashed Feature-Complete RC.**
3. **Complete automated test suite run** (all 3163+ tests) against the RC.
4. **Manual QA on minimum two Android devices and two iOS devices.**
5. **Save import/export: cross-device, cross-platform.**
6. **Lifecycle: background, foreground, screen lock, battery saver, rotation.**
7. **Offline: airplane mode, full expedition.**
8. **Every hard requirement-ID from the GDD traced to concrete evidence.**
9. **Every P0/P1 defect has reproduction steps, a minimal fix, and a
   regression test added to the test suite.**

## Checklist

- [ ] G45 gate passed (store listings populated)
- [ ] RC frozen: tag `v1.0.0-rc1` or equivalent
- [ ] Full automated test suite: 100% pass
- [ ] Device FQA: Android (2+ devices), iOS (2+ devices)
- [ ] Save round-trip: export on Android, import on iOS, continue play
- [ ] Lifecycle matrix: background, lock, rotation, battery saver, airplane
- [ ] Regression catalog: every P0/P1 has reproduction + fix + new test
- [ ] Requirement traceability report: every GDD requirement-ID traced
- [ ] No known P0 or P1 defects open