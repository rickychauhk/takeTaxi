/**
 * Shared Podfile patches for react-native-maps 1.27+ and RN Firebase static linking.
 * Used by expo config plugin (prebuild, before pod install) and postprebuild script.
 */

const mapsBlock =
  `# @generated begin react-native-maps - expo prebuild (DO NOT MODIFY) sync-e9cc66c360abe50bc66d89fffb3c55b034d7d369
  pod 'react-native-google-maps', path: File.dirname(\`node --print "require.resolve('react-native-maps/package.json')"\`)
# @generated end react-native-maps`;

const mapsReplacement = `# @generated begin react-native-maps - expo prebuild (DO NOT MODIFY) sync-e9cc66c360abe50bc66d89fffb3c55b034d7d369
  # react-native-maps 1.27+ uses subspec "Google" (no react-native-google-maps podspec).
  rn_maps_path = File.dirname(\`node --print "require.resolve('react-native-maps/package.json')"\`)
  pod 'react-native-maps', :path => rn_maps_path, :subspecs => ['Google']
# @generated end react-native-maps`;

const postInstallPatch = `    installer.pods_project.targets.each do |target|
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

/** @param {string} pod */
export function patchPodfileContents(pod) {
  let changed = false;

  if (pod.includes("pod 'react-native-google-maps'")) {
    pod = pod.replace(mapsBlock, mapsReplacement);
    changed = true;
  }

  if (!pod.includes('$FirebaseSDKVersion')) {
    pod = pod.replace(
      "podfile_properties = JSON.parse(File.read(File.join(__dir__, 'Podfile.properties.json'))) rescue {}\n",
      "podfile_properties = JSON.parse(File.read(File.join(__dir__, 'Podfile.properties.json'))) rescue {}\n\n$FirebaseSDKVersion = '12.10.0'\n$RNFirebaseAsStaticFramework = true\n",
    );
    changed = true;
  } else if (!pod.includes('$RNFirebaseAsStaticFramework')) {
    pod = pod.replace(
      "$FirebaseSDKVersion = '12.10.0'\n",
      "$FirebaseSDKVersion = '12.10.0'\n$RNFirebaseAsStaticFramework = true\n",
    );
    changed = true;
  }

  const firebasePods = `  pod 'GoogleUtilities', :modular_headers => true
  pod 'GoogleDataTransport', :modular_headers => true
  pod 'PromisesObjC', :modular_headers => true
  pod 'nanopb', :modular_headers => true

`;

  if (!pod.includes("pod 'GoogleUtilities'")) {
    pod = pod.replace('  use_expo_modules!\n\n', `  use_expo_modules!\n\n${firebasePods}`);
    changed = true;
  }

  if (pod.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
    const narrow =
      /next unless target\.name\.match\?\(\\\/\\A\(Firebase\|GoogleUtilities\|GoogleDataTransport\|PromisesObjC\|nanopb\)/;
    if (narrow.test(pod)) {
      pod = pod.replace(
        narrow,
        'next unless target.name.match?(/\\A(RNFB|Firebase|GoogleUtilities|GoogleDataTransport|PromisesObjC|nanopb)/',
      );
      changed = true;
    }
  } else {
    pod = pod.replace(
      '      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )\n  end',
      `      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )\n${postInstallPatch}  end`,
    );
    changed = true;
  }

  return { pod, changed };
}
