#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { exists, finding, isExactVersion, listFiles, major, readText, writeJsonStdout } from './lib.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const findings = [];
const check = (condition, id, message, file = null, severity = 'error') => {
  if (!condition) findings.push(finding(id, severity, message, file));
};

const baseline = JSON.parse(await readText(path.join(root, 'native/native-baseline-contract.json')));
const allowlist = JSON.parse(await readText(path.join(root, 'native/official-plugin-allowlist.json')));
const packageJson = JSON.parse(await readText(path.join(root, 'package.json')));
const capPath = path.join(root, 'capacitor.config.ts');
const cap = await readText(capPath);

check(/appId:\s*['"]com\.ceegore\.riftwarden['"]/.test(cap), 'CAP_APP_ID', 'Capacitor appId must be com.ceegore.riftwarden.', capPath);
check(/appName:\s*['"]Riftwarden['"]/.test(cap), 'CAP_APP_NAME', 'Capacitor appName must be Riftwarden.', capPath);
check(/webDir:\s*['"]dist['"]/.test(cap), 'CAP_WEB_DIR', 'Capacitor webDir must be dist.', capPath);
check(/bundledWebRuntime:\s*false/.test(cap), 'CAP_RUNTIME', 'bundledWebRuntime must be false.', capPath);
for (const pattern of [/server\s*:/, /allowNavigation\s*:/, /cleartext\s*:\s*true/, /allowMixedContent\s*:\s*true/]) {
  check(!pattern.test(cap), 'CAP_REMOTE_CONFIG', `Forbidden Capacitor release config matched ${pattern}.`, capPath);
}
check(/SystemBars\s*:/.test(cap) && /insetsHandling:\s*['"]css['"]/.test(cap), 'CAP_SYSTEM_BARS', 'SystemBars css inset handling must be configured.', capPath);

const dependencies = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
for (const item of allowlist.officialPackages) {
  const version = dependencies[item.name];
  check(typeof version === 'string', 'PLUGIN_MISSING', `Missing allowed package ${item.name}.`, 'package.json');
  if (typeof version === 'string') {
    check(major(version) === 8, 'PLUGIN_MAJOR', `${item.name} must remain on Capacitor major 8.`, 'package.json');
    check(isExactVersion(version), 'PLUGIN_EXACT', `${item.name} must be exactly pinned.`, 'package.json');
  }
}
check(!('@capacitor/system-bars' in dependencies), 'SYSTEM_BARS_PACKAGE', 'SystemBars is built into @capacitor/core; separate package is forbidden.', 'package.json');

const androidGradleCandidates = [
  path.join(root, 'android/app/build.gradle'),
  path.join(root, 'android/app/build.gradle.kts'),
];
let gradle = null;
let gradlePath = null;
for (const candidate of androidGradleCandidates) {
  if (await exists(candidate)) { gradlePath = candidate; gradle = await readText(candidate); break; }
}
check(gradle !== null, 'ANDROID_GRADLE_MISSING', 'Android app Gradle file is missing.', 'android/app');
if (gradle) {
  check(/compileSdk(?:Version)?\s*(?:=\s*)?36\b/.test(gradle), 'ANDROID_COMPILE_SDK', 'compileSdk must be 36.', gradlePath);
  check(/minSdk(?:Version)?\s*(?:=\s*)?24\b/.test(gradle), 'ANDROID_MIN_SDK', 'minSdk must be 24.', gradlePath);
  check(/targetSdk(?:Version)?\s*(?:=\s*)?36\b/.test(gradle), 'ANDROID_TARGET_SDK', 'targetSdk must be 36.', gradlePath);
  check(/versionCode\s*(?:=\s*)?10000\b/.test(gradle), 'ANDROID_VERSION_CODE', 'versionCode must be 10000.', gradlePath);
}

const manifestCandidates = [
  path.join(root, 'artifacts/native/android/merged-release/AndroidManifest.xml'),
  path.join(root, 'android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml'),
  path.join(root, 'android/app/src/main/AndroidManifest.xml'),
];
let manifestPath = null;
for (const candidate of manifestCandidates) { if (await exists(candidate)) { manifestPath = candidate; break; } }
check(Boolean(manifestPath), 'ANDROID_MANIFEST_MISSING', 'No merged/source Android manifest found.', 'android');
if (manifestPath) {
  const manifest = await readText(manifestPath);
  for (const permission of baseline.android.runtimePermissions.concat(['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE', 'com.google.android.gms.permission.AD_ID'])) {
    check(!manifest.includes(permission), 'ANDROID_PERMISSION', `Forbidden permission in inspected manifest: ${permission}`, manifestPath);
  }
  check(/android:allowBackup="false"/.test(manifest), 'ANDROID_BACKUP', 'android:allowBackup must be false.', manifestPath);
  check(!/android:usesCleartextTraffic="true"/.test(manifest), 'ANDROID_CLEARTEXT', 'Cleartext traffic must not be enabled.', manifestPath);
}

const nativeFiles = [...await listFiles(path.join(root, 'android')), ...await listFiles(path.join(root, 'ios'))];
for (const file of nativeFiles.filter((p) => /\.(xml|plist|pbxproj|gradle|kts|swift|java|json)$/.test(p))) {
  const text = await readText(file, false);
  if (!text) continue;
  check(!/https?:\/\/(?!schemas\.android\.com|www\.apple\.com)/.test(text), 'NATIVE_REMOTE_URL', 'Unexpected remote URL in native source.', file);
}

const pbx = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');
if (await exists(pbx)) {
  const text = await readText(pbx);
  check(/PRODUCT_BUNDLE_IDENTIFIER = com\.ceegore\.riftwarden;/.test(text), 'IOS_BUNDLE_ID', 'iOS bundle identifier mismatch.', pbx);
  check(/IPHONEOS_DEPLOYMENT_TARGET = 15\.0;/.test(text), 'IOS_DEPLOYMENT', 'iOS deployment target must be 15.0.', pbx);
  check(/CURRENT_PROJECT_VERSION = 10000;/.test(text), 'IOS_BUILD', 'iOS build number must be 10000.', pbx);
  check(/TARGETED_DEVICE_FAMILY = "?1,2"?;/.test(text), 'IOS_DEVICE_FAMILY', 'iOS target must be universal iPhone/iPad.', pbx);
} else {
  findings.push(finding('IOS_PROJECT_MISSING', 'blocked', 'iOS Xcode project is absent; G04 cannot pass.', pbx));
}

for (const file of (await listFiles(path.join(root, 'ios'))).filter((p) => p.endsWith('.entitlements'))) {
  const text = await readText(file);
  for (const key of baseline.ios.forbiddenEntitlements) {
    check(!text.includes(key), 'IOS_ENTITLEMENT', `Forbidden entitlement: ${key}`, file);
  }
}
const privacyFiles = (await listFiles(path.join(root, 'ios'))).filter((p) => p.endsWith('PrivacyInfo.xcprivacy'));
check(privacyFiles.length >= 1, 'IOS_PRIVACY_MANIFEST', 'PrivacyInfo.xcprivacy is required.', 'ios');

const errors = findings.filter((f) => f.severity === 'error').length;
const blocked = findings.filter((f) => f.severity === 'blocked').length;
const report = { schemaVersion: 1, root, status: errors ? 'FAIL' : blocked ? 'BLOCKED' : 'PASS', findings };
await writeJsonStdout(report);
process.exitCode = errors ? 1 : blocked ? 2 : 0;
