import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const starter = path.resolve(process.env.PHASE04_STARTER ?? '.');
const node = process.execPath;

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rw-p04-'));
  await mkdir(path.join(root, 'native'), { recursive: true });
  await mkdir(path.join(root, 'src/platform/plugins'), { recursive: true });
  await mkdir(path.join(root, 'android/app/src/main'), { recursive: true });
  await mkdir(path.join(root, 'ios/App/App.xcodeproj'), { recursive: true });
  await mkdir(path.join(root, 'ios/App/App'), { recursive: true });
  await mkdir(path.join(root, 'tools/native'), { recursive: true });
  await cp(path.join(starter, 'native'), path.join(root, 'native'), { recursive: true });
  await cp(path.join(starter, 'tools/native'), path.join(root, 'tools/native'), { recursive: true });
  await cp(path.join(starter, 'src/platform/plugins'), path.join(root, 'src/platform/plugins'), { recursive: true });
  await cp(path.join(starter, 'android-reference/app/src/main/java'), path.join(root, 'android/app/src/main/java'), { recursive: true });
  await cp(path.join(starter, 'ios-reference/App/App/Plugins'), path.join(root, 'ios/App/App/Plugins'), { recursive: true });
  await cp(path.join(starter, 'capacitor.config.ts'), path.join(root, 'capacitor.config.ts'));
  const deps = ['core','android','ios','app','filesystem','preferences','haptics','screen-orientation','splash-screen','browser'];
  const dependencies = Object.fromEntries(deps.map((name) => [`@capacitor/${name}`, '8.4.1']));
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies }, null, 2));
  await writeFile(path.join(root, 'android/app/build.gradle'), `android { namespace "com.ceegore.riftwarden"; compileSdk 36; defaultConfig { applicationId "com.ceegore.riftwarden"; minSdk 24; targetSdk 36; versionCode 10000; } }`);
  await writeFile(path.join(root, 'android/app/src/main/AndroidManifest.xml'), `<manifest><application android:allowBackup="false" android:usesCleartextTraffic="false" xmlns:android="http://schemas.android.com/apk/res/android" /></manifest>`);
  await writeFile(path.join(root, 'ios/App/App.xcodeproj/project.pbxproj'), `PRODUCT_BUNDLE_IDENTIFIER = com.ceegore.riftwarden; IPHONEOS_DEPLOYMENT_TARGET = 15.0; CURRENT_PROJECT_VERSION = 10000; TARGETED_DEVICE_FAMILY = "1,2";`);
  await cp(path.join(starter, 'ios-reference/App/App/PrivacyInfo.xcprivacy'), path.join(root, 'ios/App/App/PrivacyInfo.xcprivacy'));
  return root;
}

function run(root, tool) {
  return spawnSync(node, [path.join(root, 'tools/native', tool), root], { encoding: 'utf8' });
}

test('positive fixture passes config and plugin contracts', async () => {
  const root = await fixture();
  try {
    assert.equal(run(root, 'verify-config.mjs').status, 0);
    assert.equal(run(root, 'verify-plugin-contracts.mjs').status, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('server.url injection fails', async () => {
  const root = await fixture();
  try {
    const file = path.join(root, 'capacitor.config.ts');
    await writeFile(file, `${await readFile(file, 'utf8')}\nconst forbidden = { server: { url: 'https://evil.example' } };\n`);
    assert.equal(run(root, 'verify-config.mjs').status, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('INTERNET permission injection fails', async () => {
  const root = await fixture();
  try {
    const file = path.join(root, 'android/app/src/main/AndroidManifest.xml');
    await writeFile(file, `<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.INTERNET"/><application android:allowBackup="false"/></manifest>`);
    assert.equal(run(root, 'verify-config.mjs').status, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('mixed Capacitor major fails', async () => {
  const root = await fixture();
  try {
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    pkg.dependencies['@capacitor/browser'] = '7.0.0';
    await writeFile(path.join(root, 'package.json'), JSON.stringify(pkg));
    assert.equal(run(root, 'verify-config.mjs').status, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('missing iOS evidence blocks G04 verifier', async () => {
  const root = await fixture();
  try {
    const result = run(root, 'verify-g04.mjs');
    assert.equal(result.status, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});
