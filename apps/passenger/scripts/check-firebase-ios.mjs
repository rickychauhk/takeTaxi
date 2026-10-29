import fs from 'node:fs';
import path from 'node:path';
import {
  appRoot,
  isUsableFirebasePlist,
  rootPlist,
} from './firebase-ios-plist.mjs';

const lockPath = path.join(appRoot, 'ios', 'Podfile.lock');
const staleRnfb =
  fs.existsSync(lockPath) &&
  fs.readFileSync(lockPath, 'utf8').includes('RNFBApp') &&
  !isUsableFirebasePlist();

if (isUsableFirebasePlist()) {
  console.log(
    '[firebase] 已找到有效 GoogleService-Info.plist — RNFB 會參與 native link；preios 會同步 plist 至 Xcode。',
  );
} else if (fs.existsSync(rootPlist)) {
  console.warn(
    '[firebase] 有 GoogleService-Info.plist 但 GOOGLE_APP_ID 似係 example／placeholder — 已略過 RNFB native link。請用 Firebase Console 下載乘客 App（online.hktaketaxi.app）嘅 plist 覆蓋。',
  );
} else {
  console.log(
    '[firebase] 未找到有效 GoogleService-Info.plist — react-native.config.js 略過 @react-native-firebase native link（recaptcha 仍可 build）。',
  );
}

if (staleRnfb) {
  console.warn(
    '[firebase] Podfile.lock 仍含 RNFB，但無有效 plist — 將在 pod install 後移除；若 build 仍見 [RNFB] script，請：rm -rf ios/Pods && npm run preios',
  );
}
