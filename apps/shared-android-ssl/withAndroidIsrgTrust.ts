import {
  type ConfigPlugin,
  withAndroidManifest,
  withDangerousMod,
} from '@expo/config-plugins';
import fs from 'node:fs';
import path from 'node:path';

const SHARED = path.join(__dirname, 'res');

/** 修 Android（尤其 API ≤34）連 Let's Encrypt YE 鏈時的 SSLHandshakeException */
export const withAndroidIsrgTrust: ConfigPlugin = (config) => {
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const mainRes = path.join(root, 'app', 'src', 'main', 'res');
      copyDir(path.join(SHARED, 'raw'), path.join(mainRes, 'raw'));
      copyDir(path.join(SHARED, 'xml'), path.join(mainRes, 'xml'));
      return cfg;
    },
  ]);

  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app?.$) {
      app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    }
    return cfg;
  });

  return config;
};

function copyDir(from: string, to: string) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const src = path.join(from, name);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, path.join(to, name));
    }
  }
}

export default withAndroidIsrgTrust;
