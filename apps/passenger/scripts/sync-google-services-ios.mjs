import {
  ensurePlistInXcodeProject,
  isUsableFirebasePlist,
} from './firebase-ios-plist.mjs';

const result = ensurePlistInXcodeProject();

if (result.reason === 'no-valid-plist') {
  process.exit(0);
}

if (result.reason === 'linked') {
  console.log(
    '[firebase] 已複製 GoogleService-Info.plist 至 ios native target 並加入 Xcode Copy Bundle Resources。',
  );
} else if (result.reason === 'already-linked') {
  console.log('[firebase] 已同步 GoogleService-Info.plist（Xcode 專案已包含該檔）。');
} else if (result.reason === 'missing-pbxproj') {
  console.warn('[firebase] 已複製 plist，但搵唔到 ios/*.xcodeproj/project.pbxproj。');
}

if (!isUsableFirebasePlist()) {
  process.exit(0);
}
