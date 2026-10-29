import {
  type ConfigPlugin,
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} from '@expo/config-plugins';
import fs from 'node:fs';
import path from 'node:path';

const NATIVE_SRC = path.join(__dirname, 'android-native');

const withAndroidIncomingOrderFullScreen: ConfigPlugin = (config) => {
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    if (!manifest['uses-permission']?.some((p) => p.$?.['android:name'] === 'android.permission.USE_FULL_SCREEN_INTENT')) {
      manifest['uses-permission'] = [
        ...(manifest['uses-permission'] ?? []),
        { $: { 'android:name': 'android.permission.USE_FULL_SCREEN_INTENT' } },
      ];
    }
    const app = manifest.application?.[0];
    const activity = app?.activity?.find((a) => a.$?.['android:name'] === '.MainActivity');
    if (activity?.$) {
      activity.$['android:showWhenLocked'] = 'true';
      activity.$['android:turnScreenOn'] = 'true';
    }
    return cfg;
  });

  config = withMainApplication(config, (cfg) => {
    const src = cfg.modResults.contents;
    const pkgImport = 'import online.hktaketaxi.driverapp.incoming.IncomingOrderWindowPackage';
    const addLine = 'add(IncomingOrderWindowPackage())';
    if (!src.includes('IncomingOrderWindowPackage')) {
      let next = src.includes(pkgImport) ? src : src.replace(/package .+\n/, (m) => `${m}${pkgImport}\n`);
      next = next.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        (m) => `${m}\n          ${addLine}`,
      );
      cfg.modResults.contents = next;
    }
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const destDir = path.join(
        root,
        'app',
        'src',
        'main',
        'java',
        'online',
        'hktaketaxi',
        'driverapp',
        'incoming',
      );
      fs.mkdirSync(destDir, { recursive: true });
      for (const name of [
        'IncomingOrderWindowModule.kt',
        'IncomingOrderWindowPackage.kt',
        'IncomingOrderLaunch.kt',
      ]) {
        fs.copyFileSync(path.join(NATIVE_SRC, name), path.join(destDir, name));
      }

      const mainActivity = path.join(root, 'app', 'src', 'main', 'java', 'online', 'hktaketaxi', 'driverapp', 'MainActivity.kt');
      if (fs.existsSync(mainActivity)) {
        let src = fs.readFileSync(mainActivity, 'utf8');
        if (!src.includes('IncomingOrderLaunch')) {
          src = src.replace(
            'import android.os.Bundle',
            'import android.content.Intent\nimport android.os.Bundle\nimport online.hktaketaxi.driverapp.incoming.IncomingOrderLaunch',
          );
          src = src.replace(
            'super.onCreate(null)',
            'IncomingOrderLaunch.captureFromIntent(intent)\n    super.onCreate(null)',
          );
          if (!src.includes('onNewIntent')) {
            src = src.replace(
              '  override fun invokeDefaultOnBackPressed() {',
              `  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
    IncomingOrderLaunch.captureFromIntent(intent)
  }

  override fun invokeDefaultOnBackPressed() {`,
            );
          }
          fs.writeFileSync(mainActivity, src);
        }
      }
      return cfg;
    },
  ]);

  return config;
};

export default withAndroidIncomingOrderFullScreen;
