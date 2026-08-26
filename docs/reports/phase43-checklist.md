# Phase 43 — Android Release Pipeline & Play Store Preparation

**Status:** DOCUMENTATION-ONLY. Gate G43: BLOCKED on real device and Play Console access.

## Required Operator Evidence

1. **Real G42 gate proven.** This document cannot self-certify.
2. **Google Play Console account with full admin access.**
3. **Android signing key generated** (PEM + keystore, secured offline).
4. **Real Android device (API 30+) with developer options** for FQA.
5. **Gradle build producing a signed AAB** (not APK) with release config.
6. **Play Console listing populated:** app name, short/long descriptions,
   screenshots (min 2), feature graphic, icon (512×512), content rating
   questionnaire answered, privacy policy URL, data safety section
   declaring "no data collected."
7. **Upload key and app signing key enrolled** in Play App Signing.
8. **Internal test track** with at least one install from Play Store.
9. **No dangerous permissions declared.** Internet permission must be absent.

## Checklist

- [ ] G42 gate passed (real audit, not template)
- [ ] Play Console account created and verified
- [ ] App signing key generated (keystore backed up offline)
- [ ] release/1.0.0 branch created from green main
- [ ] `vite build --mode release` produces AAB-compatible output
- [ ] Gradle configuration: no debug signing, no internet permission
- [ ] AAB signed and uploaded to internal test track
- [ ] AAB installed from Play Store on real device
- [ ] Full expedition run on installed AAB
- [ ] Crash/ANR tested: app must not crash on normal use
- [ ] Data safety form: "no data collected" verified against audit
