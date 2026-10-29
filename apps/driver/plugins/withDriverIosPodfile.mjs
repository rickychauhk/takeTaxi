import fs from 'node:fs';
import path from 'node:path';
import { withDangerousMod } from '@expo/config-plugins';

const MARKER = '# @taxima/withDriverIosPodfile';

const PODFILE_HEADER_SNIPPET = `
${MARKER}
$FirebaseSDKVersion = '12.10.0'
$RNFirebaseAsStaticFramework = true
`;

const PODFILE_TARGET_SNIPPET = `
  ${MARKER} modular_headers
  pod 'GoogleUtilities', :modular_headers => true
  pod 'GoogleDataTransport', :modular_headers => true
  pod 'PromisesObjC', :modular_headers => true
  pod 'nanopb', :modular_headers => true
`;

const PODFILE_POST_INSTALL_SNIPPET = `
    ${MARKER} rnfb_post_install
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        if target.name.match?(/\\A(RNFB|Firebase|GoogleUtilities|GoogleDataTransport|PromisesObjC|nanopb)/)
          build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        end
        if target.name.start_with?('RNFB')
          build_config.build_settings['CLANG_ENABLE_MODULES'] = 'NO'
        end
      end
    end
`;

function ensurePodfilePatches(podfile) {
  let next = podfile;
  if (!next.includes(MARKER)) {
    next = next.replace(
      /prepare_react_native_project!\n/,
      (m) => `${m}${PODFILE_HEADER_SNIPPET}\n`,
    );
    next = next.replace(
      /target 'TakeTaxiDriver' do\n  use_expo_modules!\n/,
      (m) => `${m}${PODFILE_TARGET_SNIPPET}\n`,
    );
    next = next.replace(
      /react_native_post_install\(\n      installer,\n      config\[:reactNativePath\],[\s\S]*?:ccache_enabled => ccache_enabled\?\(podfile_properties\),\n    \)\n/,
      (m) => `${m}${PODFILE_POST_INSTALL_SNIPPET}\n`,
    );
  }
  return next;
}

/** RN Firebase + modular headers for iOS (司機 prebuild / expo config) */
export default function withDriverIosPodfile(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (fs.existsSync(podfilePath)) {
        const raw = fs.readFileSync(podfilePath, 'utf8');
        const patched = ensurePodfilePatches(raw);
        if (patched !== raw) {
          fs.writeFileSync(podfilePath, patched);
        }
      }
      return cfg;
    },
  ]);
}
