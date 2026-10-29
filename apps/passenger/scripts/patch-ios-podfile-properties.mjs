import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const propsPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'ios',
  'Podfile.properties.json',
);

if (!fs.existsSync(propsPath)) {
  process.exit(0);
}

const props = JSON.parse(fs.readFileSync(propsPath, 'utf8'));
if (props.EXPO_USE_PRECOMPILED_MODULES === 'false') {
  process.exit(0);
}

props.EXPO_USE_PRECOMPILED_MODULES = 'false';
fs.writeFileSync(propsPath, `${JSON.stringify(props, null, 2)}\n`);
console.log('[ios] Set EXPO_USE_PRECOMPILED_MODULES=false in Podfile.properties.json');
