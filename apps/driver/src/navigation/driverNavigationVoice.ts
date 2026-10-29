import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'driver.navigationVoiceEnabled';

export async function getNavigationVoiceEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === '0' || raw === 'false') return false;
  return true;
}

export async function setNavigationVoiceEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, enabled ? '1' : '0');
}
