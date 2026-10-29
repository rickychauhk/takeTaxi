/** 司機 Firebase taketaxionlinemain（iOS：ios/app/GoogleService-Info.plist；Android：google-services.json） */
const defaultAppId =
  process.env.EXPO_PUBLIC_FIREBASE_ANDROID_APP_ID ??
  process.env.EXPO_PUBLIC_FIREBASE_APP_ID ??
  '1:38342370957:web:52b68702b7882306cf64c4';

export const firebaseConfig = {
  /** JS Phone Auth 用 Web API Key（須同 API FIREBASE_WEB_API_KEY） */
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyAaWN6QBOFU9JQ198OoV9yiZ-oBS0CvfoI',
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'taketaxionlinemain.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'taketaxionlinemain',
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'taketaxionlinemain.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '38342370957',
  appId: defaultAppId,
};
