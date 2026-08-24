# Phase 44 — iOS/iPadOS Release Pipeline & App Store Preparation

**Status:** DOCUMENTATION-ONLY. Gate G44: BLOCKED on real device and App Store Connect access.

## Required Operator Evidence

1. **Real G43 gate proven.** This document cannot self-certify.
2. **Apple Developer Program membership** (organization account).
3. **Distribution certificate and provisioning profile** from Apple Developer.
4. **Real iPhone (iOS 16+) and iPad (iPadOS 16+)** for FQA.
5. **Xcode project producing archive** with release configuration.
6. **App Store Connect listing populated:** app name, subtitle, description,
   keywords, screenshots (min 3 sizes), app preview video (optional),
   content rights, age rating, privacy policy URL, App Privacy section
   declaring "no data collected."
7. **Privacy manifest (`PrivacyInfo.xcprivacy`)** listing zero data
   collection, zero tracking, zero required reason APIs.
8. **TestFlight** with at least one internal tester install.
9. **No background modes, no push notifications, no iCloud, no HealthKit.**

## Checklist

- [ ] G43 gate passed (real AAB installed from Play Store)
- [ ] Apple Developer enrollment completed
- [ ] Distribution certificate created (stored in Keychain + backed up)
- [ ] Xcode project configured: bundle ID, team, signing, entitlements
- [ ] Privacy manifest: zero data collection, zero tracking
- [ ] Archive built and uploaded to App Store Connect
- [ ] TestFlight build processed and installed on real device
- [ ] Full expedition run on real iPhone and iPad
- [ ] Silent switch, call interruption, Siri overlay tested
- [ ] App Store Connect listing completely filled out
- [ ] App Review guidelines self-check passed