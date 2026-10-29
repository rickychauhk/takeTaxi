import {
  createRunOncePlugin,
  withPodfile,
  withPodfileProperties,
} from '@expo/config-plugins';
import { patchPodfileContents } from '../scripts/iosPodfilePatches.mjs';

/** Fix Expo's legacy `react-native-google-maps` pod + Firebase static iOS setup before `pod install`. */
function withPassengerIosPodfile(config) {
  config = withPodfileProperties(config, (props) => ({
    ...props,
    EXPO_USE_PRECOMPILED_MODULES: 'false',
  }));

  config = withPodfile(config, (cfg) => {
    const { pod } = patchPodfileContents(cfg.modResults.contents);
    cfg.modResults.contents = pod;
    return cfg;
  });

  return config;
}

export default createRunOncePlugin(withPassengerIosPodfile, 'withPassengerIosPodfile');
