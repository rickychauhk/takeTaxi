import { Platform } from 'react-native';
import { openExternalMap, type ExternalMapProvider } from './externalMaps';
import type { NavigationTarget } from './navigationTarget';
import type { DriverNavigationChoice } from './preferredNavigationApp';

export async function launchDriverNavigation(
  choice: DriverNavigationChoice,
  target: NavigationTarget,
  onInAppNavigate: (target: NavigationTarget) => void,
): Promise<void> {
  if (choice === 'in_app') {
    onInAppNavigate(target);
    return;
  }
  if (choice === 'apple' && Platform.OS !== 'ios') {
    return;
  }
  await openExternalMap(choice as ExternalMapProvider, target);
}
