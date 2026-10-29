/**
 * prebuild / Gradle 有時會在 apps/driver/node_modules/expo 留下只有 build/、
 * 無 package.json 的殘缺目錄，autolinking 會用錯 expo 專案 → 原生缺 ExpoFetchModule → 一開 App crash。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const projectRoot = path.resolve(import.meta.dirname, '..');
const localExpo = path.join(projectRoot, 'node_modules', 'expo');
const require = createRequire(path.join(projectRoot, 'package.json'));

function removeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function hasExpoFetchSource(expoRoot) {
  return fs.existsSync(
    path.join(expoRoot, 'android', 'src', 'main', 'java', 'expo', 'modules', 'fetch', 'ExpoFetchModule.kt'),
  );
}

let removed = false;
if (fs.existsSync(localExpo) && !fs.existsSync(path.join(localExpo, 'package.json'))) {
  removeDir(localExpo);
  removed = true;
  console.log('[ensureExpoNativeLink] removed broken node_modules/expo stub (no package.json)');
}

let expoRoot;
try {
  expoRoot = path.dirname(require.resolve('expo/package.json'));
} catch {
  console.error('[ensureExpoNativeLink] FATAL: cannot resolve expo package from driver app');
  process.exit(1);
}

if (fs.existsSync(localExpo) && fs.existsSync(path.join(localExpo, 'package.json'))) {
  if (!hasExpoFetchSource(localExpo)) {
    removeDir(localExpo);
    removed = true;
    console.log('[ensureExpoNativeLink] removed incomplete local expo (missing fetch native sources)');
    expoRoot = path.dirname(require.resolve('expo/package.json'));
  }
}

if (!hasExpoFetchSource(expoRoot)) {
  console.error('[ensureExpoNativeLink] FATAL: expo at', expoRoot, 'missing ExpoFetchModule.kt');
  process.exit(1);
}

const packageList = path.join(
  expoRoot,
  'android',
  'build',
  'generated',
  'expo',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'ExpoModulesPackageList.kt',
);

if (fs.existsSync(packageList)) {
  const text = fs.readFileSync(packageList, 'utf8');
  if (!text.includes('ExpoFetchModule')) {
    removeDir(path.join(expoRoot, 'android', 'build', 'generated'));
    console.log('[ensureExpoNativeLink] cleared stale ExpoModulesPackageList (will regenerate on build)');
  }
}

console.log('[ensureExpoNativeLink] using expo at', expoRoot, removed ? '(after cleanup)' : '');

try {
  const ipPkg = require.resolve('expo-image-picker/package.json');
  const ipVer = JSON.parse(fs.readFileSync(ipPkg, 'utf8')).version ?? '';
  const major = Number(String(ipVer).split('.')[0]);
  if (Number.isFinite(major) && major < 50) {
    console.error(
      `[ensureExpoNativeLink] FATAL: expo-image-picker@${ipVer} is incompatible with Expo SDK 57 (need ~57.x).`,
    );
    process.exit(1);
  }
} catch {
  /* image-picker optional at link time */
}

// RN 0.86 / Android 需要 non-null Intent；expo prebuild 模板仍會生成 Intent?
const mainActivity = path.join(
  projectRoot,
  'android',
  'app',
  'src',
  'main',
  'java',
  'online',
  'hktaketaxi',
  'driverapp',
  'MainActivity.kt',
);
if (fs.existsSync(mainActivity)) {
  let kt = fs.readFileSync(mainActivity, 'utf8');
  const broken = 'override fun onNewIntent(intent: Intent?)';
  const fixed = 'override fun onNewIntent(intent: Intent)';
  if (kt.includes(broken)) {
    kt = kt.replace(broken, fixed);
    fs.writeFileSync(mainActivity, kt);
    console.log('[ensureExpoNativeLink] patched MainActivity.onNewIntent(Intent) for RN 0.86');
  }
}

function readMapsApiKeyFromEnvFiles() {
  if (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()) {
    return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.trim();
  }
  for (const name of ['.env.local', '.env']) {
    const envPath = path.join(projectRoot, name);
    if (!fs.existsSync(envPath)) continue;
    const text = fs.readFileSync(envPath, 'utf8');
    const m = text.match(/^\s*EXPO_PUBLIC_GOOGLE_MAPS_API_KEY\s*=\s*(\S+)/m);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return '';
}

const mapsKey = readMapsApiKeyFromEnvFiles();
const manifest = path.join(projectRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (mapsKey && fs.existsSync(manifest)) {
  let xml = fs.readFileSync(manifest, 'utf8');
  const next = xml.replace(
    /android:name="com\.google\.android\.geo\.API_KEY"\s+android:value="[^"]*"/,
    `android:name="com.google.android.geo.API_KEY" android:value="${mapsKey}"`,
  );
  if (next !== xml) {
    fs.writeFileSync(manifest, next);
    console.log('[ensureExpoNativeLink] synced com.google.android.geo.API_KEY from .env');
  }
}
