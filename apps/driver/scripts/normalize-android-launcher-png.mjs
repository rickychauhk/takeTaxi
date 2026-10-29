import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const resDir = path.join(appRoot, 'android', 'app', 'src', 'main', 'res');

if (!fs.existsSync(resDir)) {
  process.exit(0);
}

const names = ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png'];
let fixed = 0;

for (const folder of fs.readdirSync(resDir)) {
  if (!folder.startsWith('mipmap-')) continue;
  for (const name of names) {
    const filePath = path.join(resDir, folder, name);
    if (!fs.existsSync(filePath)) continue;
    const kind = execSync(`file -b ${JSON.stringify(filePath)}`, { encoding: 'utf8' });
    if (!kind.includes('JPEG')) continue;
    const tmp = `${filePath}.tmp.png`;
    execSync(`sips -s format png ${JSON.stringify(filePath)} --out ${JSON.stringify(tmp)}`, {
      stdio: 'ignore',
    });
    fs.renameSync(tmp, filePath);
    fixed += 1;
  }
}

if (fixed > 0) {
  console.log(`[android] Converted ${fixed} launcher PNG(s) from JPEG (AAPT requires real PNG).`);
}
