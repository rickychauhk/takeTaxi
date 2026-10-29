import { passengerFetch } from './passengerClient';

export async function postPassengerLocation(
  passengerId: string,
  lat: number,
  lng: number,
): Promise<void> {
  const res = await passengerFetch('/realtime/location', {
    method: 'POST',
    body: JSON.stringify({ userId: passengerId, role: 'passenger', lat, lng }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}
