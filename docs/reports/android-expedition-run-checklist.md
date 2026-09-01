# Android Expedition Run — Operator Checklist (G28 device evidence)

Status date: 2026-08-20 — branch `feat/09-content-schemas-sourceformat-und-compilerg`.

This checklist turns the operator-side device evidence into a reproducible
run. No device or emulator was attached in the working session, so the
real-device evidence itself remains operator work — but the toolchain is
machine-verified and the APK builds.

## Machine-verified (this revision)

| Check | Command | Result |
| --- | --- | --- |
| Native plugin contract (20 files) | `node tools/native/verify-plugin-contracts.mjs .` | `findings: []` |
| Capacitor config | `node tools/native/verify-config.mjs .` | `status: PASS` |
| Debug APK build | `pnpm android:debug` | `BUILD SUCCESSFUL in 59s` |

Tooling fix landed along the way: `tools/native/run-gradle.mjs` could not
spawn `gradlew.bat` on Windows (`spawnSync` EINVAL + cmd's bare-name
resolution). The win32 path now uses `.\gradlew.bat` through the shell;
POSIX/CI behavior is unchanged.

Artifact: `android/app/build/outputs/apk/debug/app-debug.apk` (built
2026-08-20, ~4.7 MB).

## Operator steps (real device)

1. Connect a device with USB debugging enabled and verify:
   ```bash
   adb devices          # device must be listed as "device"
   ```
2. Install and launch the debug build:
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   adb shell am start -n com.riftwarden.app/.MainActivity
   ```
3. Run the expedition minimum end to end (the S40/S41/S49 flow):
   - Start a mission from HQ → group/formation → pre-battle disclosure.
   - S40 dungeon map: tap the first reachable node; verify only reachable
     nodes are selectable (unreachable tap must be ignored).
   - S41 node preview: verify cost, instability delta and loot indication
     match the persisted payload; back must open pause, never leave the run.
   - S49 anchor: secure one loot item; double-tap secure/retreat must commit
     once; kill the app mid-transaction and resume — state must continue at
     the last confirmed commit with no double reward.
4. Capture evidence:
   - Screenshots of S40/S41/S49 (device visual goldens) — one per pinned
     golden seed if possible.
   - `adb logcat -d | grep -iE "riftwarden|save|commit|transaction"` for the
     transaction/recovery trail.
   - A 30-minute repeat run for the performance leg (memory, draw calls, long
     tasks, thermals) with `adb shell dumpsys meminfo`.
5. Record results in the G28 evidence templates (`contracts/phase28/…` or the
   Phase 29 evidence templates) with SourceRevision, device model/OS and
   timestamps, then re-run `node tools/sim/validate-phase28-readiness.mjs` —
   the gate only flips when the operator registers the evidence.

## Notes

- No AVD/emulator exists in the working environment (`emulator -list-avds` is
  empty), so emulator-based runs would not satisfy the device evidence
  contract anyway; only a real minimum/target device run counts.
- The browser legs of the same evidence are already machine-covered by
  `pnpm test:e2e:harness` (context-loss matrix, battle-start exactly-once,
  13 S40 map visual goldens).
