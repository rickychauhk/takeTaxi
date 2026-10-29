import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const iosDir = path.join(appRoot, 'ios');

function findAppDelegate() {
  if (!fs.existsSync(iosDir)) return null;
  for (const name of fs.readdirSync(iosDir)) {
    if (!name.endsWith('.xcodeproj')) continue;
    const candidate = path.join(iosDir, name.replace('.xcodeproj', ''), 'AppDelegate.swift');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const appDelegatePath = findAppDelegate();
if (!appDelegatePath) {
  process.exit(0);
}

let src = fs.readFileSync(appDelegatePath, 'utf8');
let changed = false;

if (src.includes('class AppDelegate: ExpoAppDelegate {') && !src.includes('ExpoReactNativeFactoryProvider')) {
  src = src.replace(
    'class AppDelegate: ExpoAppDelegate {',
    'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
  );
  changed = true;
}

const legacyBlock = /#if os\(iOS\) \|\| os\(tvOS\)\r?\n[\s\S]*?window = UIWindow\(frame: UIScreen\.main\.bounds\)[\s\S]*?factory\.startReactNative\([\s\S]*?launchOptions: launchOptions\)\r?\n#endif\r?\n/m;
if (legacyBlock.test(src)) {
  src = src.replace(legacyBlock, '');
  changed = true;
}

if (changed && !src.includes('EXExpoAppSceneDelegate')) {
  /* scene delegate lives in Info.plist */
}

if (changed && !src.includes('Window + React Native start in EXExpoAppSceneDelegate')) {
  src = src.replace(
    /(\/\/ @generated end react-native-maps-init\r?\n)(\s*return super\.application)/m,
    `$1\n    // Window + React Native start in EXExpoAppSceneDelegate (required on iOS 27+).\n$2`,
  );
}

if (changed) {
  fs.writeFileSync(appDelegatePath, src);
  console.log('[ios] Patched AppDelegate for UIScene (ExpoReactNativeFactoryProvider).');
}
