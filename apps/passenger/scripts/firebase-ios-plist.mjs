import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
export const appRoot = path.join(scriptsDir, '..');
export const rootPlist = path.join(appRoot, 'GoogleService-Info.plist');

const PLACEHOLDER_MARKERS = ['YOUR_PASSENGER_IOS_APP_ID', 'YOUR_IOS_API_KEY'];

export function resolveIosXcodePaths() {
  const iosDir = path.join(appRoot, 'ios');
  if (!fs.existsSync(iosDir)) return null;
  const xcodeproj = fs
    .readdirSync(iosDir)
    .find((name) => name.endsWith('.xcodeproj') && !name.startsWith('Pods'));
  if (!xcodeproj) return null;
  const nativeName = xcodeproj.replace(/\.xcodeproj$/, '');
  return {
    nativeName,
    iosPlist: path.join(iosDir, nativeName, 'GoogleService-Info.plist'),
    pbxprojPath: path.join(iosDir, xcodeproj, 'project.pbxproj'),
  };
}

const paths = resolveIosXcodePaths();
export const iosPlist = paths?.iosPlist ?? path.join(appRoot, 'ios', 'TakeTaxi', 'GoogleService-Info.plist');
export const pbxprojPath =
  paths?.pbxprojPath ?? path.join(appRoot, 'ios', 'TakeTaxi.xcodeproj', 'project.pbxproj');

export function readGoogleAppId(plistPath) {
  if (!fs.existsSync(plistPath)) return null;
  const text = fs.readFileSync(plistPath, 'utf8');
  const match = text.match(/<key>GOOGLE_APP_ID<\/key>\s*<string>([^<]+)<\/string>/);
  return match?.[1]?.trim() ?? null;
}

/** 真實 Firebase Console 下載嘅 plist（唔係 .example 改名） */
export function isUsableFirebasePlist(plistPath = rootPlist) {
  if (!fs.existsSync(plistPath)) return false;
  const text = fs.readFileSync(plistPath, 'utf8');
  if (PLACEHOLDER_MARKERS.some((m) => text.includes(m))) return false;
  const appId = readGoogleAppId(plistPath);
  if (!appId || !appId.includes(':ios:')) return false;
  return true;
}

const PBX_FILE_REF = 'F1A2B3C4D5E60718293A4B5C /* GoogleService-Info.plist */';
const PBX_BUILD_FILE = 'F1A2B3C4D5E60718293A4B5D /* GoogleService-Info.plist in Resources */';

export function ensurePlistInXcodeProject() {
  if (!isUsableFirebasePlist()) return { synced: false, reason: 'no-valid-plist' };

  const resolved = resolveIosXcodePaths();
  const nativeName = resolved?.nativeName ?? 'TakeTaxi';
  const targetIosPlist = resolved?.iosPlist ?? iosPlist;
  const targetPbx = resolved?.pbxprojPath ?? pbxprojPath;

  fs.mkdirSync(path.dirname(targetIosPlist), { recursive: true });
  fs.copyFileSync(rootPlist, targetIosPlist);

  if (!fs.existsSync(targetPbx)) {
    return { synced: true, xcode: false, reason: 'missing-pbxproj' };
  }

  let pbx = fs.readFileSync(targetPbx, 'utf8');
  if (pbx.includes('GoogleService-Info.plist')) {
    return { synced: true, xcode: true, reason: 'already-linked' };
  }

  pbx = pbx.replace(
    '/* End PBXBuildFile section */',
    `\t\t${PBX_BUILD_FILE} = {isa = PBXBuildFile; fileRef = F1A2B3C4D5E60718293A4B5C /* GoogleService-Info.plist */; };\n/* End PBXBuildFile section */`,
  );

  pbx = pbx.replace(
    '/* End PBXFileReference section */',
    `\t\tF1A2B3C4D5E60718293A4B5C /* GoogleService-Info.plist */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.plist.xml; name = "GoogleService-Info.plist"; path = ${nativeName}/GoogleService-Info.plist; sourceTree = "<group>"; };\n/* End PBXFileReference section */`,
  );

  const privacyFileLine = pbx.match(/\t\t\t\t[\w]+ \/\* PrivacyInfo\.xcprivacy \*\/,/);
  if (privacyFileLine) {
    pbx = pbx.replace(
      privacyFileLine[0],
      `${privacyFileLine[0]}\n\t\t\t\tF1A2B3C4D5E60718293A4B5C /* GoogleService-Info.plist */,`,
    );
  }

  const privacyBuildLine = pbx.match(/\t\t\t\t[\w]+ \/\* PrivacyInfo\.xcprivacy in Resources \*\/,/);
  if (privacyBuildLine) {
    pbx = pbx.replace(
      privacyBuildLine[0],
      `${privacyBuildLine[0]}\n\t\t\t\tF1A2B3C4D5E60718293A4B5D /* GoogleService-Info.plist in Resources */,`,
    );
  }

  fs.writeFileSync(targetPbx, pbx);
  return { synced: true, xcode: true, reason: 'linked' };
}
