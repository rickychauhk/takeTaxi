import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchPodfileContents } from './iosPodfilePatches.mjs';

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const podfilePath = path.join(appRoot, 'ios', 'Podfile');

if (!fs.existsSync(podfilePath)) {
  process.exit(0);
}

const pod = fs.readFileSync(podfilePath, 'utf8');
const { pod: next, changed } = patchPodfileContents(pod);

if (changed) {
  fs.writeFileSync(podfilePath, next);
  console.log('[ios] Patched Podfile (maps Google subspec + Firebase modular headers).');
}
