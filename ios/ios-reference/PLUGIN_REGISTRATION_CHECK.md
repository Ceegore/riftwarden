# Custom Plugin Registration Check

Capacitor 8 app-local Swift plugins use `CAPBridgedPlugin`. After adding the files to the App target:

1. Confirm each Swift file has App target membership.
2. Run `npx cap sync ios` with the exact Phase-02 lockfile.
3. Open the generated Xcode project and confirm the plugin classes compile.
4. Run the web-to-native `getBridgeInfo` contract test for all three names.
5. Do not add a CocoaPods fallback or third-party plugin package if SPM linking fails. Treat it as a blocker or a separately approved Capacitor patch upgrade.
