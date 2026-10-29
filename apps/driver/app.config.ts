import type { ExpoConfig } from 'expo/config';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = __dirname;
const iosGoogleServices = path.join(projectRoot, 'GoogleService-Info.plist');
const androidGoogleServices = path.join(projectRoot, 'google-services.json');

function isUsableIosGoogleServicesPlist(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const text = fs.readFileSync(filePath, 'utf8');
  const match = text.match(/<key>GOOGLE_APP_ID<\/key>\s*<string>([^<]+)<\/string>/);
  const appId = match?.[1]?.trim();
  return Boolean(appId && appId.includes(':ios:'));
}

const iosFirebaseNativeReady = isUsableIosGoogleServicesPlist(iosGoogleServices);
const androidFirebaseNativeReady = fs.existsSync(androidGoogleServices);
const firebaseNativeReady = iosFirebaseNativeReady && androidFirebaseNativeReady;
const hasAndroidGoogleServices = androidFirebaseNativeReady;

const DRIVER_ONESIGNAL_APP_ID =
  process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID?.trim() ||
  '89adb767-9f3c-4bb2-8151-8de2062877d2';

const config: ExpoConfig = {
  name: 'Take Taxi Driver',
  slug: 'taxima-driver',
  version: '1.0.0',
  updates: {
    enabled: false,
  },
  orientation: 'default',
  icon: './assets/icon.png',
  /** 整張 splash.png = 黑底全屏 loading（非獨立 logo） */
  splash: {
    image: './assets/splash.png',
    resizeMode: 'cover',
    backgroundColor: '#000000',
  },
  userInterfaceStyle: 'dark',
  scheme: 'taxima-driver',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'online.hktaketaxi.driverapp',
    ...(iosFirebaseNativeReady
      ? { googleServicesFile: './GoogleService-Info.plist' as const }
      : {}),
    infoPlist: {
      NSMicrophoneUsageDescription:
        '搭的司機版需要麥克風，以便在出貨頁以語音輸入起點與目的地。',
      NSSpeechRecognitionUsageDescription:
        '搭的司機版需要語音辨識，以便在出貨頁以語音輸入起點與目的地。',
      LSApplicationQueriesSchemes: [
        'tel',
        'telprompt',
        'comgooglemaps',
        'maps',
        'iosamap',
        'amapuri',
      ],
      NSLocationWhenInUseUsageDescription:
        '搭的司機版需要位置權限才能上線接單；乘客會透過 App 查看你的即時位置。',
      NSCameraUsageDescription: '搭的司機版需要相機以拍攝行車證或入數證明。',
      NSPhotoLibraryUsageDescription: '搭的司機版需要存取相簿以上傳行車證或入數證明。',
      NSPhotoLibraryAddUsageDescription: '搭的司機版需要將相片儲存至相簿（如有需要）。',
      UIBackgroundModes: ['remote-notification'],
      RCTMetroPort: '8082',
      UIApplicationSceneManifest: {
        UIApplicationSupportsMultipleScenes: false,
        UISceneConfigurations: {
          UIWindowSceneSessionRoleApplication: [
            {
              UISceneConfigurationName: 'Default Configuration',
              UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
            },
          ],
        },
      },
    },
    entitlements: {
      'aps-environment':
        process.env.NODE_ENV === 'production' ? 'production' : 'development',
    },
  },
  autolinking: {
    android: {
      exclude: ['expo-firebase-core'],
    },
  },
  plugins: [
    // Must be first — avoids iOS OneSignal/OneSignal.h build errors (onesignal-expo-plugin docs)
    [
      'onesignal-expo-plugin',
      {
        mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
        smallIconAccentColor: '#F73A0B',
        appGroupName: 'group.online.hktaketaxi.driverapp.onesignal',
      },
    ],
    './plugins/withDriverIosPodfile.mjs',
    './plugins/withAndroidIncomingOrderFullScreen',
    path.join(projectRoot, '..', 'shared-android-ssl', 'withAndroidIsrgTrust.ts'),
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          '搭的司機版需要背景定位，以便你收 App 時仍能收到附近柯打 push。',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    'expo-localization',
    [
      'expo-image-picker',
      {
        photosPermission: '搭的司機版需要存取相簿以上傳行車證或入數證明。',
        cameraPermission: '搭的司機版需要相機以拍攝行車證或入數證明。',
      },
    ],
    '@react-native-community/datetimepicker',
    [
      'expo-speech-recognition',
      {
        microphonePermission:
          '搭的司機版需要麥克風，以便在出貨頁以語音輸入起點與目的地。',
        speechRecognitionPermission:
          '搭的司機版需要語音辨識，以便在出貨頁以語音輸入起點與目的地。',
      },
    ],
    ...(firebaseNativeReady
      ? ([
          '@react-native-firebase/app',
          '@react-native-firebase/crashlytics',
          [
            'expo-build-properties',
            {
              ios: {
                useFrameworks: 'static',
                enableSceneSupport: true,
                buildReactNativeFromSource: true,
                forceStaticLinking: [
                  'React-Fabric',
                  'React-FabricComponents',
                  'React-rendererconsistency',
                  'React-RCTFabric',
                ],
              },
            },
          ],
        ] as ExpoConfig['plugins'])
      : []),
  ],
  locales: {
    en: './locales/en.json',
    'zh-Hant': './locales/zh-Hant.json',
  },
  android: {
    package: 'online.hktaketaxi.driverapp',
    ...(firebaseNativeReady
      ? { googleServicesFile: './google-services.json' as const }
      : hasAndroidGoogleServices
        ? { googleServicesFile: './google-services.json' as const }
        : {}),
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'POST_NOTIFICATIONS',
      'USE_FULL_SCREEN_INTENT',
    ],
    adaptiveIcon: {
      backgroundColor: '#ffffff',
      foregroundImage: './assets/android-icon-foreground.png',
    },
  },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://app.hktaketaxi.online/api/v1',
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    oneSignalAppId: DRIVER_ONESIGNAL_APP_ID,
  },
};

export default config;
