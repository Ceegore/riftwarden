# iOS Phase-04 Project Patch

Apply through Xcode/build settings and review the `project.pbxproj` diff:

- `PRODUCT_BUNDLE_IDENTIFIER = com.ceegore.riftwarden`
- `IPHONEOS_DEPLOYMENT_TARGET = 15.0`
- `MARKETING_VERSION = 1.0.0`
- `CURRENT_PROJECT_VERSION = 10000`
- `TARGETED_DEVICE_FAMILY = "1,2"`
- Swift Package Manager, no CocoaPods fallback
- Landscape-left/right supported on iPhone; iPad remains adaptive and supports required multitasking orientations
- No `UIBackgroundModes`
- No ATS exception dictionary
- `UIViewControllerBasedStatusBarAppearance = YES`
- `PrivacyInfo.xcprivacy` is included in the App target resources
- `App.entitlements` stays empty unless a later approved phase introduces an entitlement

Use `xcodebuild -showBuildSettings` and an archive/simulator build as evidence. Editing text without Xcode evidence cannot satisfy G04.
