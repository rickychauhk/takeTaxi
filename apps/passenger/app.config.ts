import type { ExpoConfig } from 'expo/config';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = __dirname;
const iosGoogleServices = path.join(projectRoot, 'GoogleService-Info.plist');
const androidGoogleServices = path.join(projectRoot, 'google-services.json');

function isUsableIosGoogleServicesPlist(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const text = fs.readFileSync(filePath, 'utf8');
  if (text.includes('YOUR_PASSENGER_IOS_APP_ID') || text.includes('YOUR_IOS_API_KEY')) {
    return false;
  }
  const match = text.match(/<key>GOOGLE_APP_ID<\/key>\s*<string>([^<]+)<\/string>/);
  const appId = match?.[1]?.trim();
  return Boolean(appId && appId.includes(':ios:'));
}

const iosFirebaseNativeReady = isUsableIosGoogleServicesPlist(iosGoogleServices);
const androidFirebaseNativeReady = fs.existsSync(androidGoogleServices);
const firebaseNativeReady = iosFirebaseNativeReady && androidFirebaseNativeReady;

const PASSENGER_ONESIGNAL_APP_ID =
  process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID?.trim() ||
  '971c34e0-e863-4735-b474-d83dc3b63263';

const config: ExpoConfig = {
  name: '搭的乘客版',
  slug: 'taxima-passenger',
  version: '1.0.0',
  /** 內測 APK 唔走 Expo OTA，避免啟動時 updates 檢查異常 */
  updates: {
    enabled: false,
  },
  orientation: 'portrait',
  icon: './assets/icon.png',
  /** 整張 splash.png = 黑底全屏 loading（非獨立 logo） */
  splash: {
    image: './assets/splash.png',
    resizeMode: 'cover',
    backgroundColor: '#000000',
  },
  userInterfaceStyle: 'dark',
  scheme: 'taxima',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'online.hktaketaxi.app',
    ...(iosFirebaseNativeReady
      ? { googleServicesFile: './GoogleService-Info.plist' as const }
      : {}),
    entitlements: {
      'aps-environment':
        process.env.NODE_ENV === 'production' ? 'production' : 'development',
    },
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    },
    infoPlist: {
      LSApplicationQueriesSchemes: ['tel', 'telprompt'],
      NSLocationWhenInUseUsageDescription: '搭的 需要你的位置以顯示上車點及附近司機。',
      NSPhotoLibraryUsageDescription: '搭的需要存取相簿，以便上傳失物協助圖片。',
      NSPhotoLibraryAddUsageDescription: '搭的需要將相片儲存至相簿（如有需要）。',
      NSCameraUsageDescription: '搭的需要相機以拍攝失物協助圖片。',
      UIBackgroundModes: ['remote-notification'],
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
  },
  android: {
    package: 'online.hktaketaxi.app',
    ...(firebaseNativeReady
      ? { googleServicesFile: './google-services.json' as const }
      : {}),
    adaptiveIcon: {
      backgroundColor: '#ffffff',
      foregroundImage: './assets/android-icon-foreground.png',
    },
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'POST_NOTIFICATIONS',
    ],
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
  },
  locales: {
    en: './locales/en.json',
    'zh-Hant': './locales/zh-Hant.json',
  },
  autolinking: {
    android: {
      exclude: ['expo-firebase-core'],
    },
  },
  plugins: [
    [
      'onesignal-expo-plugin',
      {
        mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
        smallIconAccentColor: '#F73A0B',
        appGroupName: 'group.online.hktaketaxi.app.onesignal',
      },
    ],
    path.join(projectRoot, '..', 'shared-android-ssl', 'withAndroidIsrgTrust.ts'),
    ...(firebaseNativeReady
      ? ([
          '@react-native-firebase/app',
          '@react-native-firebase/crashlytics',
          [
            'expo-build-properties',
            {
              ios: {
                useFrameworks: 'static',
              },
            },
          ],
        ] as ExpoConfig['plugins'])
      : iosFirebaseNativeReady
        ? ([
            [
              'expo-build-properties',
              {
                ios: {
                  useFrameworks: 'static',
                },
              },
            ],
          ] as ExpoConfig['plugins'])
        : []),
    'expo-localization',
    'expo-location',
    [
      'expo-image-picker',
      {
        photosPermission: '搭的需要存取相簿，以便上傳失物協助圖片。',
        cameraPermission: '搭的需要相機以拍攝失物協助圖片。',
      },
    ],
    '@react-native-community/datetimepicker',
    './plugins/withPassengerIosPodfile.mjs',
  ],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://app.hktaketaxi.online/api/v1',
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    oneSignalAppId: PASSENGER_ONESIGNAL_APP_ID,
    firebaseNativeReady,
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
};

export default config;
