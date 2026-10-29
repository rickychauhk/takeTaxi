const fs = require('fs');
const path = require('path');

const plistPath = path.join(__dirname, 'GoogleService-Info.plist');

function isUsableFirebasePlist(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const text = fs.readFileSync(filePath, 'utf8');
  const match = text.match(/<key>GOOGLE_APP_ID<\/key>\s*<string>([^<]+)<\/string>/);
  const appId = match?.[1]?.trim();
  return Boolean(appId && appId.includes(':ios:'));
}

const firebaseNativeReady = isUsableFirebasePlist(plistPath);

/** 無 GoogleService-Info.plist 時唔 link RNFB，避免 Crashlytics build script 失敗 */
const disabledNativeFirebase = {
  '@react-native-firebase/app': { platforms: { ios: null, android: null } },
  '@react-native-firebase/crashlytics': { platforms: { ios: null, android: null } },
};

/** expo-firebase-core 6 與 Expo 57 Android 不相容；OTP Recaptcha 走 WebView */
const disabledLegacyFirebaseCore = {
  'expo-firebase-core': { platforms: { android: null } },
};

module.exports = {
  dependencies: {
    ...disabledLegacyFirebaseCore,
    ...(firebaseNativeReady ? {} : disabledNativeFirebase),
  },
};
