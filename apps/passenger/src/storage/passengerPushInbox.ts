import AsyncStorage from '@react-native-async-storage/async-storage';

export type PassengerPushInboxItem = {
  id: string;
  title: string;
  body: string;
  receivedAt: number;
};

const STORAGE_KEY = 'passenger_push_inbox_v1';
const MAX_ITEMS = 120;

export async function readPassengerPushInbox(): Promise<PassengerPushInboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is PassengerPushInboxItem =>
          x != null &&
          typeof x === 'object' &&
          typeof (x as PassengerPushInboxItem).id === 'string' &&
          typeof (x as PassengerPushInboxItem).title === 'string' &&
          typeof (x as PassengerPushInboxItem).body === 'string' &&
          typeof (x as PassengerPushInboxItem).receivedAt === 'number',
      )
      .sort((a, b) => b.receivedAt - a.receivedAt);
  } catch {
    return [];
  }
}

export async function appendPassengerPushInbox(item: Omit<PassengerPushInboxItem, 'receivedAt'> & {
  receivedAt?: number;
}): Promise<void> {
  const title = item.title?.trim() ?? '';
  const body = item.body?.trim() ?? '';
  if (!title && !body) return;

  const receivedAt = item.receivedAt ?? Date.now();
  const id = item.id?.trim() || `local-${receivedAt}`;
  const rows = await readPassengerPushInbox();
  const next: PassengerPushInboxItem = { id, title, body, receivedAt };
  const deduped = rows.filter(
    (r) => !(r.id === id || (r.title === title && r.body === body && Math.abs(r.receivedAt - receivedAt) < 60_000)),
  );
  const merged = [next, ...deduped].slice(0, MAX_ITEMS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}
