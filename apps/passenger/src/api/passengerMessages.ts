import { passengerApiErrorMessage, passengerFetch } from './passengerClient';

export type PassengerCrmMessage = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  createdAtHk: string | null;
  source: 'crm';
};

export async function fetchPassengerCrmMessages(): Promise<PassengerCrmMessage[]> {
  const res = await passengerFetch('/passenger/messages');
  if (!res.ok) {
    const text = await res.text();
    throw new Error(passengerApiErrorMessage(res.status, text));
  }
  const data = (await res.json()) as { items?: PassengerCrmMessage[] };
  return data.items ?? [];
}
