import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Langili',
  slug: 'langili',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'langili',
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'appVersion' },
  ios: {
    bundleIdentifier: 'com.langili.app',
    icon: './assets/expo.icon',
  },
  android: {
    package: 'com.langili.app',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  extra: {
    // The client revision (spec §4 and §7): the Pages build commit, absent from local builds so
    // Diagnostics shows `Not supplied` rather than a similar-looking value.
    clientRevision: process.env.CF_PAGES_COMMIT_SHA,
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
