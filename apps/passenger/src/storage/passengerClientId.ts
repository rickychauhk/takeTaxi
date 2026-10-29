import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'taxima_passenger_app_client_id';

function generateClientId(): string {
  const hex = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-a${hex().slice(1)}-${hex()}${hex()}${hex()}`;
}

/** 裝置持久化 ID，對應 CRM passengers.app_client_id */
export async function getOrCreatePassengerClientId(): Promise<string> {
  const existing = await AsyncStorage.getItem(STORAGE_KEY);
  if (existing?.trim()) return existing.trim();
  const id = generateClientId();
  await AsyncStorage.setItem(STORAGE_KEY, id);
  return id;
}
