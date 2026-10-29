import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(appRoot, 'assets', 'splash.png');
const res = path.join(appRoot, 'android', 'app', 'src', 'main', 'res');
const iosSet = path.join(appRoot, 'ios', 'TakeTaxiDriver', 'Images.xcassets', 'SplashScreen.imageset');

if (!fs.existsSync(src)) {
  process.exit(0);
}

function sipsOut(args) {
  const cmd = ['-s', 'format', 'png', ...args];
  execSync(`sips ${cmd.map((a) => JSON.stringify(a)).join(' ')}`, { stdio: 'ignore' });
}

function readImageSize(filePath) {
  const out = execSync(`sips -g pixelWidth -g pixelHeight ${JSON.stringify(filePath)}`, {
    encoding: 'utf8',
  });
  const w = Number(out.match(/pixelWidth: (\d+)/)?.[1]);
  const h = Number(out.match(/pixelHeight: (\d+)/)?.[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new Error(`Cannot read splash dimensions: ${filePath}`);
  }
  return { w, h };
}

const { w: srcW, h: srcH } = readImageSize(src);

const android = [
  ['mdpi', 320],
  ['hdpi', 480],
  ['xhdpi', 720],
  ['xxhdpi', 1080],
  ['xxxhdpi', 1440],
];

for (const [folder, width] of android) {
  const height = Math.round((width * srcH) / srcW);
  const out = path.join(res, `drawable-${folder}`, 'splashscreen_logo.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  sipsOut(['-z', String(height), String(width), src, '--out', out]);
}

const splashDrawableDir = path.join(res, 'drawable');
fs.mkdirSync(splashDrawableDir, { recursive: true });
fs.writeFileSync(
  path.join(splashDrawableDir, 'splashscreen.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/splashscreen_background" />
  <item>
    <bitmap
      android:gravity="center"
      android:src="@drawable/splashscreen_logo" />
  </item>
</layer-list>
`,
);

fs.mkdirSync(iosSet, { recursive: true });
const contentsJson = {
  images: [
    { filename: 'splash.png', idiom: 'universal', scale: '1x' },
    { filename: 'splash@2x.png', idiom: 'universal', scale: '2x' },
    { filename: 'splash@3x.png', idiom: 'universal', scale: '3x' },
  ],
  info: { author: 'xcode', version: 1 },
};
fs.writeFileSync(path.join(iosSet, 'Contents.json'), `${JSON.stringify(contentsJson, null, 2)}\n`);

for (const [name, width] of [
  ['splash.png', srcW],
  ['splash@2x.png', srcW * 2],
  ['splash@3x.png', srcW * 3],
]) {
  const height = Math.round((width * srcH) / srcW);
  sipsOut(['-z', String(height), String(width), src, '--out', path.join(iosSet, name)]);
}

console.log('[splash] Synced Android drawable-* and iOS SplashScreen.imageset from assets/splash.png.');
