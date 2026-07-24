import type { CapacitorConfig } from '@capacitor/cli';

const buildChannel = process.env.VITE_BUILD_CHANNEL ?? 'dev';
const isRelease = buildChannel === 'release';

if (!['dev', 'qa', 'release'].includes(buildChannel)) {
  throw new Error(`Unsupported VITE_BUILD_CHANNEL: ${buildChannel}`);
}

const config: CapacitorConfig = {
  appId: 'com.ceegore.riftwarden',
  appName: 'Riftwarden',
  webDir: 'dist',
  loggingBehavior: isRelease ? 'none' : 'debug',
  android: {
    path: 'android',
    allowMixedContent: false,
    webContentsDebuggingEnabled: !isRelease,
    loggingBehavior: isRelease ? 'none' : 'debug',
  },
  ios: {
    path: 'ios',
    scheme: 'App',
    loggingBehavior: isRelease ? 'none' : 'debug',
    allowsLinkPreview: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
      hidden: false,
      animation: 'NONE',
    },
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0,
    },
  },
};

// Deliberately no server.url, allowNavigation, cleartext or remote hostname.
export default config;
