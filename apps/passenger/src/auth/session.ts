import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'taxima_passenger_auth_token';
const PROFILE_KEY = 'taxima_passenger_auth_profile';
const PHONE_KEY = 'taxima_passenger_remember_phone';

export type StoredPassenger = {
  id: string;
  phone: string | null;
  displayName: string | null;
};

export async function persistPassengerSession(token: string, passenger: StoredPassenger, expiresAt?: string | null) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [PROFILE_KEY, JSON.stringify({ passenger, expiresAt: expiresAt ?? null })],
  ]);
}

export async function readStoredPassengerSession(): Promise<{
  token: string;
  passenger: StoredPassenger;
  expiresAt: string | null;
} | null> {
  const [[, token], [, profileRaw]] = await AsyncStorage.multiGet([TOKEN_KEY, PROFILE_KEY]);
  if (!token?.trim() || !profileRaw) return null;
  try {
    const parsed = JSON.parse(profileRaw) as { passenger: StoredPassenger; expiresAt?: string | null };
    if (!parsed.passenger?.id) return null;
    return { token: token.trim(), passenger: parsed.passenger, expiresAt: parsed.expiresAt ?? null };
  } catch {
    return null;
  }
}

export async function clearPassengerSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, PROFILE_KEY]);
}

export async function loadRememberPhone(): Promise<string> {
  return (await AsyncStorage.getItem(PHONE_KEY)) ?? '';
}

export async function saveRememberPhone(phone: string) {
  await AsyncStorage.setItem(PHONE_KEY, phone.trim());
}
