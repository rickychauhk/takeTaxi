import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { ExternalMapProvider } from './externalMaps';

const KEY = 'driver.preferredNavigationApp';

export type DriverNavigationChoice = 'in_app' | ExternalMapProvider;

export type DriverExternalMapChoice = ExternalMapProvider;

export function defaultExternalNavigationApp(): DriverExternalMapChoice {
  return Platform.OS === 'ios' ? 'apple' : 'google';
}

export async function getPreferredNavigationApp(): Promise<DriverNavigationChoice> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === 'in_app' || raw === 'apple' || raw === 'google' || raw === 'gaode') {
    return raw;
  }
  return defaultExternalNavigationApp();
}

export async function getPreferredExternalMapApp(): Promise<DriverExternalMapChoice> {
  const choice = await getPreferredNavigationApp();
  if (choice === 'in_app') return defaultExternalNavigationApp();
  return choice;
}

export async function setPreferredNavigationApp(choice: DriverNavigationChoice): Promise<void> {
  await AsyncStorage.setItem(KEY, choice);
}
